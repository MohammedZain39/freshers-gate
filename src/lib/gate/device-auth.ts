import "server-only";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const HEADER_NAME = "x-gate-device-token";

export function hashGateDeviceToken(
  token: string
) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function authenticateGateDevice(
  request: Request
) {
  const token =
    request.headers.get(
      HEADER_NAME
    );

  if (!token) {
    return null;
  }

  if (
    token.length < 32 ||
    token.length > 256
  ) {
    return null;
  }

  const tokenHash =
    hashGateDeviceToken(token);

  const device =
    await prisma.gateDevice.findUnique({
      where: {
        tokenHash,
      },
    });

  if (
    !device ||
    !device.active
  ) {
    return null;
  }

  // Update last-seen timestamp.
  await prisma.gateDevice.update({
    where: {
      id: device.id,
    },
    data: {
      lastSeenAt: new Date(),
    },
  });

  return device;
}