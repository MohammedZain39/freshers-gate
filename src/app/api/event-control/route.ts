import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENT_NAME = "Freshers 2K26";

async function getOrCreateEventControl() {
  return prisma.eventControl.upsert({
    where: {
      eventName: EVENT_NAME,
    },
    update: {},
    create: {
      eventName: EVENT_NAME,
      entryEnabled: false,
    },
  });
}

/**
 * GET
 *
 * Returns the current entry-control status.
 */
export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const eventControl =
      await getOrCreateEventControl();

    return NextResponse.json({
      success: true,
      event: {
        id: eventControl.id,
        name: eventControl.eventName,
        entryEnabled: eventControl.entryEnabled,
        startedAt:
          eventControl.startedAt?.toISOString() ?? null,
        stoppedAt:
          eventControl.stoppedAt?.toISOString() ?? null,
        updatedAt:
          eventControl.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "Event control GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load event control status.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST
 *
 * Body:
 * {
 *   "action": "START"
 * }
 *
 * or
 *
 * {
 *   "action": "STOP"
 * }
 */
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Only administrators can control event entry.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const action =
      typeof body.action === "string"
        ? body.action.toUpperCase()
        : "";

    if (
      action !== "START" &&
      action !== "STOP"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid action. Use START or STOP.",
        },
        { status: 400 }
      );
    }

    const existing =
      await getOrCreateEventControl();

    /*
     * START ENTRY
     */
    if (action === "START") {
      /*
       * Already active.
       * Don't create another start time.
       */
      if (existing.entryEnabled) {
        return NextResponse.json({
          success: true,
          message: "Entry is already active.",
          event: {
            id: existing.id,
            name: existing.eventName,
            entryEnabled: existing.entryEnabled,
            startedAt:
              existing.startedAt?.toISOString() ??
              null,
            stoppedAt:
              existing.stoppedAt?.toISOString() ??
              null,
          },
        });
      }

      const now = new Date();

      const updated =
        await prisma.eventControl.update({
          where: {
            id: existing.id,
          },
          data: {
            entryEnabled: true,
            startedAt: now,
            stoppedAt: null,
            updatedById: admin.id,
          },
        });

      return NextResponse.json({
        success: true,
        message:
          "Freshers Gate entry is now ACTIVE.",
        event: {
          id: updated.id,
          name: updated.eventName,
          entryEnabled:
            updated.entryEnabled,
          startedAt:
            updated.startedAt?.toISOString() ??
            null,
          stoppedAt:
            updated.stoppedAt?.toISOString() ??
            null,
        },
      });
    }

    /*
     * STOP ENTRY
     */
    if (!existing.entryEnabled) {
      return NextResponse.json({
        success: true,
        message: "Entry is already closed.",
        event: {
          id: existing.id,
          name: existing.eventName,
          entryEnabled:
            existing.entryEnabled,
          startedAt:
            existing.startedAt?.toISOString() ??
            null,
          stoppedAt:
            existing.stoppedAt?.toISOString() ??
            null,
        },
      });
    }

    const now = new Date();

    const updated =
      await prisma.eventControl.update({
        where: {
          id: existing.id,
        },
        data: {
          entryEnabled: false,
          stoppedAt: now,
          updatedById: admin.id,
        },
      });

    return NextResponse.json({
      success: true,
      message:
        "Freshers Gate entry is now CLOSED.",
      event: {
        id: updated.id,
        name: updated.eventName,
        entryEnabled:
          updated.entryEnabled,
        startedAt:
          updated.startedAt?.toISOString() ??
          null,
        stoppedAt:
          updated.stoppedAt?.toISOString() ??
          null,
      },
    });
  } catch (error) {
    console.error(
      "Event control POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update event control.",
      },
      { status: 500 }
    );
  }
}