import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateGateDevice,
} from "@/lib/gate/device-auth";

type SyncScan = {
  id: string;
  studentId: string;
  qrTokenHash: string;
  scannedAt: string;
};

export async function POST(
  request: Request
) {
  try {
    // =========================================
    // GATE DEVICE AUTHENTICATION
    // =========================================

    const device =
      await authenticateGateDevice(
        request
      );

    if (!device) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unauthorized gate device.",
        },
        {
          status: 401,
        }
      );
    }

    // =========================================
    // READ REQUEST
    // =========================================

    const body =
      await request.json();

    const scans: SyncScan[] =
      Array.isArray(body.scans)
        ? body.scans
        : [];

    // Nothing to synchronize.
    if (scans.length === 0) {
      return NextResponse.json({
        success: true,
        synced: [],
        conflicts: [],
        failed: [],
      });
    }

    // Prevent oversized requests.
    if (scans.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too many scans in one synchronization request.",
        },
        {
          status: 400,
        }
      );
    }

    const synced: string[] = [];
    const conflicts: string[] = [];
    const failed: string[] = [];

    // =========================================
    // PROCESS EACH OFFLINE SCAN
    // =========================================

    for (const scan of scans) {
      try {
        // -------------------------------------
        // BASIC VALIDATION
        // -------------------------------------

        if (
          !scan.id ||
          !scan.studentId ||
          !scan.qrTokenHash ||
          !scan.scannedAt
        ) {
          failed.push(
            scan.id || "unknown"
          );

          continue;
        }

        // -------------------------------------
        // TRANSACTION
        // -------------------------------------

        const result =
          await prisma.$transaction(
            async (tx) => {
              const student =
                await tx.student.findUnique({
                  where: {
                    id: scan.studentId,
                  },

                  select: {
                    id: true,
                    status: true,
                    year: true,
                    qrTokenHash: true,
                    enteredAt: true,
                  },
                });

              // Student no longer exists.
              if (!student) {
                return "FAILED" as const;
              }

              // QR credential doesn't match
              // the student stored in the database.
              if (
                student.qrTokenHash !==
                scan.qrTokenHash
              ) {
                return "FAILED" as const;
              }

              // Someone already entered online
              // before this offline scan synced.
              if (
                student.enteredAt
              ) {
                return "CONFLICT" as const;
              }

              // Student is no longer eligible.
              if (
                student.status !==
                  "ACTIVE" ||
                (student.year !== 1 &&
                  student.year !== 2)
              ) {
                return "FAILED" as const;
              }

              // ---------------------------------
              // VALIDATE SCAN TIME
              // ---------------------------------

              const scannedAt =
                new Date(
                  scan.scannedAt
                );

              if (
                Number.isNaN(
                  scannedAt.getTime()
                )
              ) {
                return "FAILED" as const;
              }

              // ---------------------------------
              // ATOMIC CLAIM
              // ---------------------------------

              const claimed =
                await tx.student.updateMany({
                  where: {
                    id: student.id,

                    enteredAt: null,

                    status: "ACTIVE",

                    year: {
                      in: [1, 2],
                    },
                  },

                  data: {
                    enteredAt:
                      scannedAt,
                  },
                });

              if (
                claimed.count !== 1
              ) {
                return "CONFLICT" as const;
              }

              // ---------------------------------
              // ENTRY LOG
              // ---------------------------------

              await tx.entryLog.create({
                data: {
                  studentId:
                    student.id,

                  scannerId:
                    null,

                  scannedAt,

                  result:
                    "ALLOWED",
                },
              });

              return "SYNCED" as const;
            },

            {
              timeout: 10000,
            }
          );

        // -------------------------------------
        // RESULT
        // -------------------------------------

        if (
          result === "SYNCED"
        ) {
          synced.push(
            scan.id
          );
        } else if (
          result === "CONFLICT"
        ) {
          conflicts.push(
            scan.id
          );
        } else {
          failed.push(
            scan.id
          );
        }
      } catch (error) {
        console.error(
          "Offline scan sync error:",
          scan.id,
          error
        );

        failed.push(
          scan.id
        );
      }
    }

    // =========================================
    // RESPONSE
    // =========================================

    return NextResponse.json({
      success: true,

      deviceId: device.id,

      synced,

      conflicts,

      failed,
    });
  } catch (error) {
    console.error(
      "Gate sync API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to synchronize gate scans.",
      },
      {
        status: 500,
      }
    );
  }
}