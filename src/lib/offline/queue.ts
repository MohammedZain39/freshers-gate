import { getGateDB } from "./db";

function generateId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export async function queueOfflineScan(
  studentId: string,
  qrTokenHash: string,
  scannedAt: string
) {
  const db = await getGateDB();

  const existing = await db
    .transaction("scans")
    .store
    .index("by-student")
    .getAll(studentId);

  const unsynced = existing.find(
    (scan) => !scan.synced
  );

  if (unsynced) {
    return unsynced;
  }

  const scan = {
    id: generateId(),
    studentId,
    qrTokenHash,
    scannedAt,
    synced: false,
  };

  await db.put("scans", scan);

  return scan;
}

export async function getPendingScans() {
  const db = await getGateDB();

  return db
    .transaction("scans")
    .store
    .index("by-synced")
    .getAll(0);
}

export async function markScanSynced(
  scanId: string
) {
  const db = await getGateDB();

  const scan = await db
    .transaction("scans")
    .store
    .get(scanId);

  if (!scan) {
    return;
  }

  scan.synced = true;

  await db.put("scans", scan);
}