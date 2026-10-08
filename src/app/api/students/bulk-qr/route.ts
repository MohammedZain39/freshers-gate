import { NextResponse } from "next/server";
import crypto from "crypto";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generateQrCredential() {
  return crypto.randomBytes(32).toString("hex");
}

function hashQrCredential(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const studentIds = Array.isArray(body.studentIds)
      ? body.studentIds.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      : [];

    if (studentIds.length === 0) {
      return NextResponse.json(
        { error: "No students selected." },
        { status: 400 }
      );
    }

    if (studentIds.length > 500) {
      return NextResponse.json(
        {
          error:
            "Maximum 500 students can be processed in one batch.",
        },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: {
        id: {
          in: studentIds,
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
        rollNo: true,
        studentName: true,
        program: true,
        branch: true,
        year: true,
        qrTokenHash: true,
      },
    });

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No eligible students found." },
        { status: 404 }
      );
    }

    const results: {
      id: string;
      rollNo: string;
      studentName: string;
      credential: string;
    }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const student of students) {
        // Never overwrite an existing credential in this endpoint.
        if (student.qrTokenHash) {
          continue;
        }

        const credential = generateQrCredential();
        const qrTokenHash = hashQrCredential(credential);

        await tx.student.update({
          where: {
            id: student.id,
          },
          data: {
            qrTokenHash,
          },
        });

        results.push({
          id: student.id,
          rollNo: student.rollNo,
          studentName: student.studentName,
          credential,
        });
      }
    });

    return NextResponse.json({
      success: true,
      requested: studentIds.length,
      processed: students.length,
      generated: results.length,
      skippedExisting: students.length - results.length,
      credentials: results,
    });
  } catch (error) {
    console.error("Bulk QR generation error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate QR credentials.",
      },
      { status: 500 }
    );
  }
}