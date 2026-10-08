import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const yearParam = searchParams.get("year") || "";
    const branch = searchParams.get("branch") || "";
    const status = searchParams.get("status") || "";

    const year =
      yearParam === "1" || yearParam === "2"
        ? Number(yearParam)
        : undefined;

    const students = await prisma.student.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  rollNo: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  studentName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),

        ...(year ? { year } : {}),

        ...(branch ? { branch } : {}),

        ...(status === "ACTIVE" || status === "INACTIVE"
          ? { status }
          : {}),
      },

      orderBy: [
        {
          year: "asc",
        },
        {
          rollNo: "asc",
        },
      ],

      select: {
        id: true,
        rollNo: true,
        studentName: true,
        program: true,
        branch: true,
        year: true,
        status: true,
        qrTokenHash: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      students: students.map((student) => ({
        ...student,
        hasQrCredential: Boolean(student.qrTokenHash),
        qrTokenHash: undefined,
      })),
      total: students.length,
    });
  } catch (error) {
    console.error("Students API error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch students.",
      },
      { status: 500 }
    );
  }
}