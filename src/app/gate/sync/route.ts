import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SyncScan = {
  id: string;
  studentId: string;
  qrTokenHash: string;
  scannedAt: string;
};

export async function POST(request: Request) {
  try {
    // --------------------------------------
    // Authenticate scanner/admin
    // --------------------------------------

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

    // Gate synchronization is available only to
    // ADMIN and SCANNER accounts.
    if (
      admin.role !== "ADMIN" &&
      admin.role !== "SCANNER"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to synchronize gate scans.",
        },
        { status: 403 }
      );
    }

    // If this is a scanner account, attach its AdminUser ID
    // to every synchronized entry log.
    const scannerId =
      admin.role === "SCANNER"
        ? admin.id
        : null;

    const body = await request.json();

    const scans: SyncScan[] = Array.isArray(
      body.scans
    )
      ? body.scans
      : [];

    if (scans.length === 0) {
      return NextResponse.json({
        success: true,
        synced: [],
        conflicts: [],
        failed: [],
      });
    }

    // Safety limit
    if (scans.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too many scans in one synchronization request.",
        },
        { status: 400 }
      );
    }

    const synced: string[] = [];
    const conflicts: string[] = [];
    const failed: string[] = [];

    for (const scan of scans) {
      try {
        if (
          !scan.id ||
          !scan.studentId ||
          !scan.qrTokenHash ||
          !scan.scannedAt
        ) {
          failed.push(scan.id || "unknown");
          continue;
        }

        const result =
          await prisma.$transaction(
            async (tx) => {
              // --------------------------------------
              // Verify student exists
              // --------------------------------------

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

              if (!student) {
                return "FAILED" as const;
              }

              // --------------------------------------
              // Verify QR belongs to this student
              // --------------------------------------

              if (
                student.qrTokenHash !==
                scan.qrTokenHash
              ) {
                return "FAILED" as const;
              }

              // --------------------------------------
              // Already entered
              // --------------------------------------

              if (student.enteredAt) {
                return "CONFLICT" as const;
              }

              // --------------------------------------
              // Student eligibility
              // --------------------------------------

              if (
                student.status !== "ACTIVE" ||
                (student.year !== 1 &&
                  student.year !== 2)
              ) {
                return "FAILED" as const;
              }

              const scannedAt =
                new Date(scan.scannedAt);

              if (
                Number.isNaN(
                  scannedAt.getTime()
                )
              ) {
                return "FAILED" as const;
              }

              // --------------------------------------
              // ATOMIC SERVER CLAIM
              // --------------------------------------

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
                    enteredAt: scannedAt,
                  },
                });

              if (claimed.count !== 1) {
                return "CONFLICT" as const;
              }

              // --------------------------------------
              // Create entry log
              // --------------------------------------

              await tx.entryLog.create({
                data: {
                  studentId: student.id,

                  // IMPORTANT:
                  // SCANNER → logged-in scanner account ID
                  // ADMIN   → null
                  scannerId,

                  scannedAt,
                  result: "ALLOWED",
                },
              });

              return "SYNCED" as const;
            },
            {
              timeout: 10000,
            }
          );

        if (result === "SYNCED") {
          synced.push(scan.id);
        } else if (result === "CONFLICT") {
          conflicts.push(scan.id);
        } else {
          failed.push(scan.id);
        }
      } catch (error) {
        console.error(
          "Offline scan sync error:",
          scan.id,
          error
        );

        failed.push(scan.id);
      }
    }

    return NextResponse.json({
      success: true,

      // Useful for debugging/admin monitoring
      scanner: {
        id: admin.id,
        name: admin.name,
        role: admin.role,
      },

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
        error: "Failed to synchronize gate scans.",
      },
      {
        status: 500,
      }
    );
  }
}