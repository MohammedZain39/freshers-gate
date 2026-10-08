import {
  addPendingEntry,
  claimLocalEntry,
  getStudentByQrHash,
} from "./db";

async function hashCredential(
  credential: string
) {
  const encoder = new TextEncoder();

  const data = encoder.encode(
    credential
  );

  const hashBuffer =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  const hashArray = Array.from(
    new Uint8Array(hashBuffer)
  );

  return hashArray
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

export async function verifyQrLocally(
  credential: string
) {
  const cleanCredential =
    credential.trim();

  /*
   * ==================================================
   * EMPTY QR
   * ==================================================
   */

  if (!cleanCredential) {
    return {
      result: "DENIED" as const,
      reason: "EMPTY_QR",
      student: null,
    };
  }

  /*
   * ==================================================
   * HASH QR CREDENTIAL
   * ==================================================
   */

  const qrTokenHash =
    await hashCredential(
      cleanCredential
    );

  /*
   * ==================================================
   * FIND STUDENT
   * ==================================================
   */

  const student =
    await getStudentByQrHash(
      qrTokenHash
    );

  /*
   * ==================================================
   * UNKNOWN QR
   * ==================================================
   */

  if (!student) {
    const entryId =
      crypto.randomUUID();

    await addPendingEntry({
      id: entryId,
      studentId: null,
      qrTokenHash,
      scannedAt:
        new Date().toISOString(),
      result: "DENIED",
      denialReason: "INVALID_QR",
      syncStatus: "PENDING",
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    });

    return {
      result: "DENIED" as const,
      reason: "INVALID_QR",
      student: null,
    };
  }

  /*
   * ==================================================
   * INACTIVE STUDENT
   * ==================================================
   */

  if (student.status !== "ACTIVE") {
    const entryId =
      crypto.randomUUID();

    await addPendingEntry({
      id: entryId,
      studentId: student.id,
      qrTokenHash,
      scannedAt:
        new Date().toISOString(),
      result: "DENIED",
      denialReason: "STUDENT_INACTIVE",
      syncStatus: "PENDING",
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    });

    return {
      result: "DENIED" as const,
      reason: "STUDENT_INACTIVE",
      student,
    };
  }

  /*
   * ==================================================
   * ATOMIC ENTRY CLAIM
   *
   * First scan:
   *     ALLOWED
   *
   * Second scan:
   *     ALREADY_ENTERED
   *
   * The check and insertion happen in one
   * IndexedDB transaction.
   * ==================================================
   */

  const entryId =
    crypto.randomUUID();

  const entry: Parameters<
    typeof claimLocalEntry
  >[0] = {
    id: entryId,
    studentId: student.id,
    qrTokenHash,
    scannedAt:
      new Date().toISOString(),
    result: "ALLOWED",
    denialReason: null,
    syncStatus: "PENDING",
    syncAttempts: 0,
    lastSyncAttemptAt: null,
  };

  const claim =
    await claimLocalEntry(entry);

  /*
   * ==================================================
   * SECOND / DUPLICATE SCAN
   * ==================================================
   */

  if (!claim.allowed) {
    const duplicateEntryId =
      crypto.randomUUID();

    await addPendingEntry({
      id: duplicateEntryId,
      studentId: student.id,
      qrTokenHash,
      scannedAt:
        new Date().toISOString(),
      result: "ALREADY_ENTERED",
      denialReason:
        "ALREADY_ENTERED_ON_THIS_SCANNER",
      syncStatus: "PENDING",
      syncAttempts: 0,
      lastSyncAttemptAt: null,
    });

    return {
      result:
        "ALREADY_ENTERED" as const,
      reason:
        "ALREADY_ENTERED_ON_THIS_SCANNER",
      student,
    };
  }

  /*
   * ==================================================
   * FIRST SCAN SUCCESS
   * ==================================================
   */

  return {
    result: "ALLOWED" as const,
    reason: null,
    student,
  };
}