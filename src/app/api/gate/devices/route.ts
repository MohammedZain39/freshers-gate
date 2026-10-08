import { NextResponse } from "next/server";
import crypto from "crypto";

import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  hashGateDeviceToken,
} from "@/lib/gate/device-auth";

function generateGateDeviceToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

// =============================================
// CREATE GATE DEVICE
// =============================================

export async function POST(
  request: Request
) {
  try {
    // -----------------------------------------
    // ADMIN AUTHENTICATION
    // -----------------------------------------

    const admin =
      await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      admin.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only administrators can create gate devices.",
        },
        {
          status: 403,
        }
      );
    }

    // -----------------------------------------
    // REQUEST BODY
    // -----------------------------------------

    const body =
      await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gate device name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gate device name is too long.",
        },
        {
          status: 400,
        }
      );
    }

    // -----------------------------------------
    // GENERATE CREDENTIAL
    // -----------------------------------------

    const token =
      generateGateDeviceToken();

    const tokenHash =
      hashGateDeviceToken(token);

    // -----------------------------------------
    // SAVE DEVICE
    // -----------------------------------------

    const device =
      await prisma.gateDevice.create({
        data: {
          name,
          tokenHash,
          active: true,
        },

        select: {
          id: true,
          name: true,
          active: true,
          createdAt: true,
        },
      });

    // -----------------------------------------
    // RETURN TOKEN ONCE
    // -----------------------------------------

    return NextResponse.json({
      success: true,

      device,

      /*
       * IMPORTANT:
       *
       * This is the ONLY response containing
       * the actual device credential.
       *
       * The database stores only tokenHash.
       *
       * The token should be saved securely
       * on the physical gate device.
       */

      token,
    });
  } catch (error) {
    console.error(
      "Gate device creation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to create gate device.",
      },
      {
        status: 500,
      }
    );
  }
}

// =============================================
// LIST GATE DEVICES
// =============================================

export async function GET() {
  try {
    const admin =
      await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      admin.role !== "ADMIN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only administrators can view gate devices.",
        },
        {
          status: 403,
        }
      );
    }

    const devices =
      await prisma.gateDevice.findMany({
        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          name: true,
          active: true,
          lastSeenAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    return NextResponse.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error(
      "Gate device list error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to load gate devices.",
      },
      {
        status: 500,
      }
    );
  }
}