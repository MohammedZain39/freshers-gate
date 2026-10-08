import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENT_NAME = "Freshers 2K26";

export async function GET() {
  try {
    // ---------------------------------------------
    // 1. AUTHENTICATION
    // ---------------------------------------------

    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------
    // 2. LOAD STUDENT COUNTS
    // ---------------------------------------------
    //
    // Keep these sequential instead of firing many
    // Prisma queries simultaneously.
    //

    const totalStudents = await prisma.student.count({
      where: {
        year: {
          in: [1, 2],
        },
      },
    });

    const firstYear = await prisma.student.count({
      where: {
        year: 1,
      },
    });

    const secondYear = await prisma.student.count({
      where: {
        year: 2,
      },
    });

    const activeStudents = await prisma.student.count({
      where: {
        year: {
          in: [1, 2],
        },
        status: "ACTIVE",
      },
    });

    const enteredStudents = await prisma.student.count({
      where: {
        year: {
          in: [1, 2],
        },
        status: "ACTIVE",
        enteredAt: {
          not: null,
        },
      },
    });

    // ---------------------------------------------
    // 3. SUCCESSFUL ENTRY LOGS
    // ---------------------------------------------

    const allowedEntries = await prisma.entryLog.count({
      where: {
        result: "ALLOWED",
      },
    });

    // ---------------------------------------------
    // 4. EVENT CONTROL
    // ---------------------------------------------

    const eventControl =
      await prisma.eventControl.findUnique({
        where: {
          eventName: EVENT_NAME,
        },
      });

    // ---------------------------------------------
    // 5. CALCULATE REMAINING
    // ---------------------------------------------

    const remaining = Math.max(
      activeStudents - enteredStudents,
      0
    );

    // ---------------------------------------------
    // 6. RESPONSE
    // ---------------------------------------------

    return NextResponse.json(
      {
        success: true,

        stats: {
          totalStudents,
          firstYear,
          secondYear,
          activeStudents,
          enteredStudents,
          allowedEntries,
          remaining,
        },

        event: eventControl
          ? {
              id: eventControl.id,
              name: eventControl.eventName,
              entryEnabled: eventControl.entryEnabled,

              startedAt:
                eventControl.startedAt?.toISOString() ?? null,

              stoppedAt:
                eventControl.stoppedAt?.toISOString() ?? null,

              updatedAt:
                eventControl.updatedAt.toISOString(),
            }
          : {
              id: null,
              name: EVENT_NAME,
              entryEnabled: false,
              startedAt: null,
              stoppedAt: null,
              updatedAt: null,
            },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    // ---------------------------------------------
    // IMPORTANT:
    // Keep the real error in the server terminal.
    // Never expose database details to the browser.
    // ---------------------------------------------

    console.error(
      "========================================"
    );

    console.error(
      "Freshers Gate Dashboard API Error"
    );

    console.error(error);

    console.error(
      "========================================"
    );

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load dashboard data.",
      },
      {
        status: 500,
      }
    );
  }
}