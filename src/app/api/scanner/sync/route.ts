import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const students = await prisma.student.findMany({
      where: {
        status: "ACTIVE",
        qrTokenHash: {
          not: null,
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
        updatedAt: true,
      },
      orderBy: {
        rollNo: "asc",
      },
    });

    const verificationStudents = students.map(
      (student) => ({
        id: student.id,
        rollNo: student.rollNo,
        studentName: student.studentName,
        program: student.program,
        branch: student.branch,
        year: student.year,
        status: student.status,
        qrTokenHash: student.qrTokenHash!,
        updatedAt:
          student.updatedAt.toISOString(),
      })
    );

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      total: verificationStudents.length,
      students: verificationStudents,
    });
  } catch (error) {
    console.error(
      "Scanner sync error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to synchronize scanner data.",
      },
      { status: 500 }
    );
  }
}