import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        rollNo: true,
        studentName: true,
        program: true,
        branch: true,
        year: true,
        status: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Student API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch student.",
      },
      { status: 500 }
    );
  }
}