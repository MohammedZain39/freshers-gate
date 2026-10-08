import {
  getPendingScans,
  markScanSynced,
} from "./queue";

let syncing = false;

export async function syncPendingScans() {
  // Prevent multiple sync processes
  // from running simultaneously.
  if (syncing) {
    return;
  }

  // Nothing to do without internet.
  if (!navigator.onLine) {
    return;
  }

  syncing = true;

  try {
    const pending =
      await getPendingScans();

    // No offline scans waiting.
    if (pending.length === 0) {
      return;
    }

    console.log(
      `Freshers Gate: syncing ${pending.length} offline scan(s)...`
    );

    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(() => {
        controller.abort();
      }, 8000);

    try {
      const response =
        await fetch("/api/gate/sync", {
          method: "POST",

          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            scans: pending.map(
              (scan) => ({
                id: scan.id,

                studentId:
                  scan.studentId,

                qrTokenHash:
                  scan.qrTokenHash,

                scannedAt:
                  scan.scannedAt,
              })
            ),
          }),

          signal: controller.signal,
        });

      // Server/network failure.
      // IMPORTANT:
      // Do not delete anything locally.
      // The next retry will try again.
      if (!response.ok) {
        console.warn(
          "Freshers Gate sync failed:",
          response.status
        );

        return;
      }

      const data =
        await response.json();

      if (!data.success) {
        console.warn(
          "Freshers Gate sync rejected:",
          data.error
        );

        return;
      }

      // -----------------------------------------
      // SUCCESSFULLY SYNCED
      // -----------------------------------------

      for (
        const id of data.synced ?? []
      ) {
        await markScanSynced(id);
      }

      // -----------------------------------------
      // CONFLICTS
      // -----------------------------------------
      //
      // Example:
      // Student was scanned offline on this
      // phone, but another gate already
      // accepted that student online.
      //
      // Server is the source of truth.
      // Therefore this local queue item can
      // safely be marked as handled.
      //

      for (
        const id of data.conflicts ?? []
      ) {
        await markScanSynced(id);
      }

      console.log(
        "Freshers Gate sync completed:",
        {
          synced:
            data.synced?.length ?? 0,

          conflicts:
            data.conflicts?.length ?? 0,

          failed:
            data.failed?.length ?? 0,
        }
      );
    } finally {
      window.clearTimeout(
        timeout
      );
    }
  } catch (error) {
    /*
     * Network disappeared, server timed out,
     * browser connection failed, etc.
     *
     * DO NOT remove pending scans.
     *
     * They remain safely in IndexedDB and
     * will be retried later.
     */

    console.warn(
      "Freshers Gate sync temporarily unavailable:",
      error
    );
  } finally {
    syncing = false;
  }
}