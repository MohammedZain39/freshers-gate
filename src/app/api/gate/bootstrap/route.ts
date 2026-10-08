import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENT_NAME = "Freshers 2K26";

export async function GET() {
  try {
    // --------------------------------------
    // Authenticate logged-in user
    // --------------------------------------

    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please sign in.",
        },
        { status: 401 }
      );
    }

    // Only ADMIN and SCANNER can prepare
    // the local gate database.
    if (
      admin.role !== "ADMIN" &&
      admin.role !== "SCANNER"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to use the gate.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------
    // Event control
    // --------------------------------------

    const eventControl =
      await prisma.eventControl.findUnique({
        where: {
          eventName: EVENT_NAME,
        },
      });

    // --------------------------------------
    // Load eligible students
    // --------------------------------------

    const students =
      await prisma.student.findMany({
        where: {
          year: {
            in: [1, 2],
          },
        },

        select: {
          id: true,
          rollNo: true,
          studentName: true,
          program: true,
          branch: true,
          year: true,
          status: true,
          qrTokenHash: true,
          enteredAt: true,
        },

        orderBy: {
          rollNo: "asc",
        },
      });

    // Only students with generated QR credentials
    // can be used by the offline gate database.
    const eligibleStudents = students
      .filter(
        (
          student
        ): student is typeof student & {
          qrTokenHash: string;
        } => Boolean(student.qrTokenHash)
      )
      .map((student) => ({
        id: student.id,
        rollNo: student.rollNo,
        studentName: student.studentName,
        program: student.program,
        branch: student.branch,
        year: student.year,
        status: student.status,
        qrTokenHash: student.qrTokenHash,
        enteredAt:
          student.enteredAt?.toISOString() ?? null,
      }));

    return NextResponse.json(
      {
        success: true,

        // Identify the operator who initialized
        // this gate database.
        scanner: {
          id: admin.id,
          name: admin.name,
          role: admin.role,
        },

        event: {
          name: EVENT_NAME,
          entryEnabled:
            eventControl?.entryEnabled ?? false,
          updatedAt:
            eventControl?.updatedAt?.toISOString() ??
            null,
        },

        generatedAt: new Date().toISOString(),

        count: eligibleStudents.length,

        students: eligibleStudents,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Gate bootstrap error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to prepare gate database.",
      },
      {
        status: 500,
      }
    );
  }
}