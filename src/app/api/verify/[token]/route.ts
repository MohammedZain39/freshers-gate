import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

const EVENT_NAME = "Freshers 2K26";

function formatIST(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function invalidQrResponse() {
  return NextResponse.json(
    {
      success: false,
      status: "INVALID_QR",
      title: "INVALID QR",
      subtitle: "QR NOT RECOGNIZED",
      message:
        "This QR code is invalid or not recognized by Freshers Gate.",
    },
    { status: 404 }
  );
}

function alreadyScannedResponse(student: {
  studentName: string;
  rollNo: string;
  program: string;
  branch: string;
  year: number;
  enteredAt: Date;
}) {
  return NextResponse.json({
    success: true,
    status: "ALREADY_SCANNED",
    title: "ALREADY SCANNED",
    subtitle: "ENTRY ALREADY RECORDED",
    message: "This student has already entered the event.",
    student: {
      name: student.studentName,
      rollNo: student.rollNo,
      program: student.program,
      branch: student.branch,
      year: student.year,
    },
    enteredAt: student.enteredAt.toISOString(),
    enteredAtIST: formatIST(student.enteredAt),
  });
}

function notAuthorizedResponse(student: {
  studentName: string;
  rollNo: string;
  branch: string;
  year: number;
}) {
  return NextResponse.json({
    success: false,
    status: "NOT_AUTHORIZED",
    title: "NOT AUTHORIZED",
    subtitle: "ENTRY DENIED",
    message:
      "This student is currently not authorized to enter.",
    student: {
      name: student.studentName,
      rollNo: student.rollNo,
      branch: student.branch,
      year: student.year,
    },
  });
}

function notEligibleResponse(student: {
  studentName: string;
  rollNo: string;
  branch: string;
  year: number;
}) {
  return NextResponse.json({
    success: false,
    status: "NOT_ELIGIBLE",
    title: "NOT ELIGIBLE",
    subtitle: "ENTRY DENIED",
    message:
      "Only 1st and 2nd year students are eligible for Freshers Gate entry.",
    student: {
      name: student.studentName,
      rollNo: student.rollNo,
      branch: student.branch,
      year: student.year,
    },
  });
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ token: string }>;
  }
) {
  try {
    // --------------------------------------------------
    // 1. AUTHENTICATE LOGGED-IN USER
    // --------------------------------------------------

    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          status: "UNAUTHORIZED",
          message: "Please sign in to use Freshers Gate.",
        },
        { status: 401 }
      );
    }

    // Only ADMIN and SCANNER can verify QR codes.
    if (
      admin.role !== "ADMIN" &&
      admin.role !== "SCANNER"
    ) {
      return NextResponse.json(
        {
          success: false,
          status: "FORBIDDEN",
          message: "You are not authorized to scan QR codes.",
        },
        { status: 403 }
      );
    }

    // A scanner operator's ID will be attached to EntryLog.
    const scannerId =
      admin.role === "SCANNER" ? admin.id : null;

    // --------------------------------------------------
    // 2. GET TOKEN
    // --------------------------------------------------

    const { token } = await params;

    // --------------------------------------------------
    // 3. BASIC TOKEN VALIDATION
    // --------------------------------------------------

    if (
      !token ||
      token.length !== 64 ||
      !/^[a-fA-F0-9]{64}$/.test(token)
    ) {
      return invalidQrResponse();
    }

    // --------------------------------------------------
    // 4. CHECK EVENT STATUS
    // --------------------------------------------------

    const eventControl =
      await prisma.eventControl.findUnique({
        where: {
          eventName: EVENT_NAME,
        },
      });

    if (
      !eventControl ||
      !eventControl.entryEnabled
    ) {
      return NextResponse.json({
        success: false,
        status: "ENTRY_CLOSED",
        title: "ENTRY CLOSED",
        subtitle: "ENTRY NOT ACTIVE",
        message:
          "Freshers Gate entry is currently closed.",
      });
    }

    // --------------------------------------------------
    // 5. HASH TOKEN
    // --------------------------------------------------

    const qrTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // --------------------------------------------------
    // 6. FIND STUDENT
    // --------------------------------------------------

    const student =
      await prisma.student.findUnique({
        where: {
          qrTokenHash,
        },
        select: {
          id: true,
          rollNo: true,
          studentName: true,
          program: true,
          branch: true,
          year: true,
          status: true,
          enteredAt: true,
        },
      });

    if (!student) {
      return invalidQrResponse();
    }

    // --------------------------------------------------
    // 7. STUDENT ACTIVE STATUS
    // --------------------------------------------------

    if (student.status !== "ACTIVE") {
      return notAuthorizedResponse({
        studentName: student.studentName,
        rollNo: student.rollNo,
        branch: student.branch,
        year: student.year,
      });
    }

    // --------------------------------------------------
    // 8. YEAR ELIGIBILITY
    // --------------------------------------------------

    if (
      student.year !== 1 &&
      student.year !== 2
    ) {
      return notEligibleResponse({
        studentName: student.studentName,
        rollNo: student.rollNo,
        branch: student.branch,
        year: student.year,
      });
    }

    // --------------------------------------------------
    // 9. FAST ALREADY-SCANNED CHECK
    // --------------------------------------------------

    if (student.enteredAt) {
      return alreadyScannedResponse({
        studentName: student.studentName,
        rollNo: student.rollNo,
        program: student.program,
        branch: student.branch,
        year: student.year,
        enteredAt: student.enteredAt,
      });
    }

    // --------------------------------------------------
    // 10. ATOMIC ENTRY CLAIM
    // --------------------------------------------------

    const now = new Date();

    const result =
      await prisma.$transaction(
        async (tx) => {
          const claimed =
            await tx.student.updateMany({
              where: {
                id: student.id,
                enteredAt: null,
                status: "ACTIVE",
                year: {
                  in: [1, 2],
                },
              },
              data: {
                enteredAt: now,
              },
            });

          // Another scanner already claimed this student.
          if (claimed.count !== 1) {
            return {
              claimed: false,
            };
          }

          // Record successful entry together with
          // the scanner operator who performed it.
          await tx.entryLog.create({
            data: {
              studentId: student.id,
              scannerId,
              scannedAt: now,
              result: "ALLOWED",
            },
          });

          return {
            claimed: true,
          };
        },
        {
          timeout: 10000,
        }
      );

    // --------------------------------------------------
    // 11. HANDLE RACE CONDITION
    // --------------------------------------------------

    if (!result.claimed) {
      const updatedStudent =
        await prisma.student.findUnique({
          where: {
            id: student.id,
          },
          select: {
            studentName: true,
            rollNo: true,
            program: true,
            branch: true,
            year: true,
            enteredAt: true,
          },
        });

      if (
        updatedStudent &&
        updatedStudent.enteredAt
      ) {
        return alreadyScannedResponse({
          studentName:
            updatedStudent.studentName,
          rollNo:
            updatedStudent.rollNo,
          program:
            updatedStudent.program,
          branch:
            updatedStudent.branch,
          year:
            updatedStudent.year,
          enteredAt:
            updatedStudent.enteredAt,
        });
      }

      return NextResponse.json(
        {
          success: false,
          status: "VERIFICATION_FAILED",
          title: "VERIFICATION FAILED",
          subtitle: "PLEASE SCAN AGAIN",
          message:
            "The QR could not be verified. Please scan it again.",
        },
        {
          status: 409,
        }
      );
    }

    // --------------------------------------------------
    // 12. FIRST SCAN SUCCESS
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      status: "ALLOWED",
      title: "ENTRY ALLOWED",
      subtitle: "AUTHORIZED",
      message: "Entry successfully recorded.",
      student: {
        name: student.studentName,
        rollNo: student.rollNo,
        program: student.program,
        branch: student.branch,
        year: student.year,
      },
      enteredAt: now.toISOString(),
      enteredAtIST: formatIST(now),

      // Useful for the gate UI / debugging.
      scanner: {
        id: admin.id,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error(
      "Freshers Gate verification error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        status: "SERVER_ERROR",
        title: "VERIFICATION ERROR",
        subtitle: "PLEASE TRY AGAIN",
        message:
          "Something went wrong while verifying this QR.",
      },
      {
        status: 500,
      }
    );
  }
}