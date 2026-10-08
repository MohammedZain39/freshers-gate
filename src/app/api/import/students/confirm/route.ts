import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateQrCredential,
  hashQrCredential,
} from "@/lib/qr";

type StudentInput = {
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
};

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: "Only administrators can import students.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!Array.isArray(body.students) || body.students.length === 0) {
      return NextResponse.json(
        {
          error: "No students were provided for import.",
        },
        { status: 400 }
      );
    }

    const students = body.students as StudentInput[];

    const seenRollNumbers = new Set<string>();

    // Server-side validation
    for (const student of students) {
      const rollNo = String(student.rollNo ?? "")
        .trim()
        .toUpperCase();

      const studentName = String(student.studentName ?? "").trim();
      const program = String(student.program ?? "").trim();
      const branch = String(student.branch ?? "").trim();
      const year = Number(student.year);

      if (!rollNo || !studentName || !program || !branch) {
        return NextResponse.json(
          {
            error: `Invalid student record: ${
              rollNo || "unknown"
            }`,
          },
          { status: 400 }
        );
      }

      if (![1, 2].includes(year)) {
        return NextResponse.json(
          {
            error: `Invalid year for ${rollNo}.`,
          },
          { status: 400 }
        );
      }

      if (program.toUpperCase() !== "B.TECH") {
        return NextResponse.json(
          {
            error: `Invalid program for ${rollNo}.`,
          },
          { status: 400 }
        );
      }

      if (seenRollNumbers.has(rollNo)) {
        return NextResponse.json(
          {
            error: `Duplicate RollNo: ${rollNo}`,
          },
          { status: 400 }
        );
      }

      seenRollNumbers.add(rollNo);
    }

    const rollNumbers = Array.from(seenRollNumbers);

    // Check existing database records
    const existingStudents =
      await prisma.student.findMany({
        where: {
          rollNo: {
            in: rollNumbers,
          },
        },
        select: {
          rollNo: true,
        },
      });

    if (existingStudents.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some students already exist in the database.",
          duplicateRollNumbers:
            existingStudents.map(
              (student) => student.rollNo
            ),
        },
        { status: 409 }
      );
    }

    /*
     * Generate the QR credentials.
     *
     * The plaintext credential exists only in memory and
     * is returned once to the authenticated administrator.
     */
    const credentials = students.map((student) => {
      const qrCredential = generateQrCredential();

      return {
        rollNo: student.rollNo.trim().toUpperCase(),
        studentName: student.studentName.trim(),
        program: student.program.trim(),
        branch: student.branch.trim(),
        year: Number(student.year),
        qrTokenHash: hashQrCredential(qrCredential),
        qrCredential,
      };
    });

    /*
     * Store only the hash in PostgreSQL.
     */
    await prisma.$transaction(async (tx) => {
      await tx.student.createMany({
        data: credentials.map((student) => ({
          rollNo: student.rollNo,
          studentName: student.studentName,
          program: student.program,
          branch: student.branch,
          year: student.year,
          qrTokenHash: student.qrTokenHash,
        })),
      });
    });

    /*
     * Return the plaintext credentials exactly once.
     *
     * These are intended for QR-card generation/export.
     */
    return NextResponse.json({
      success: true,
      imported: credentials.length,
      message: `${credentials.length} students imported successfully.`,
      credentials: credentials.map((student) => ({
        rollNo: student.rollNo,
        studentName: student.studentName,
        year: student.year,
        branch: student.branch,
        qrCredential: student.qrCredential,
      })),
    });
  } catch (error) {
    console.error("Student import error:", error);

    return NextResponse.json(
      {
        error: "Student import failed.",
      },
      { status: 500 }
    );
  }
}