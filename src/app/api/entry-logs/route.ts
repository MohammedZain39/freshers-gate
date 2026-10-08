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
    const yearParam = searchParams.get("year") || "ALL";
    const branch = searchParams.get("branch") || "ALL";

    const year =
      yearParam === "1" || yearParam === "2"
        ? Number(yearParam)
        : undefined;

    const logs = await prisma.entryLog.findMany({
      where: {
        result: "ALLOWED",

        student: {
          ...(search
            ? {
                OR: [
                  {
                    studentName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    rollNo: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),

          ...(year !== undefined
            ? {
                year,
              }
            : {}),

          ...(branch !== "ALL"
            ? {
                branch,
              }
            : {}),
        },
      },

      orderBy: {
        scannedAt: "desc",
      },

      take: 500,

      select: {
        id: true,
        scannedAt: true,
        result: true,

        student: {
          select: {
            id: true,
            rollNo: true,
            studentName: true,
            program: true,
            branch: true,
            year: true,
            enteredAt: true,
          },
        },

        scanner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const totalAllowed = await prisma.entryLog.count({
      where: {
        result: "ALLOWED",
      },
    });

    const totalStudents = await prisma.student.count({
      where: {
        year: {
          in: [1, 2],
        },
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      logs,
      stats: {
        totalAllowed,
        totalStudents,
        remaining: Math.max(totalStudents - totalAllowed, 0),
      },
    });
  } catch (error) {
    console.error("ENTRY LOGS ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to load entry logs.",
      },
      {
        status: 500,
      }
    );
  }
}