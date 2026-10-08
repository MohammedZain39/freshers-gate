import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
} from "idb";

export type CachedStudent = {
  id: string;
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
  status: "ACTIVE" | "INACTIVE";
  qrTokenHash: string;
  updatedAt: string;
};

export type PendingEntry = {
  id: string;
  studentId: string | null;
  qrTokenHash: string;
  scannedAt: string;
  result: "ALLOWED" | "DENIED" | "ALREADY_ENTERED";
  denialReason: string | null;
  syncStatus: "PENDING" | "SYNCED" | "FAILED";
  syncAttempts: number;
  lastSyncAttemptAt: string | null;
};

interface ScannerDB extends DBSchema {
  students: {
    key: string;
    value: CachedStudent;
    indexes: {
      "by-rollNo": string;
      "by-status": string;
      "by-qrTokenHash": string;
    };
  };

  entries: {
    key: string;
    value: PendingEntry;
    indexes: {
      "by-syncStatus": string;
      "by-scannedAt": string;
      "by-studentId": string;
    };
  };

  metadata: {
    key: string;
    value: {
      key: string;
      value: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ScannerDB>> | null = null;

function getDatabase() {
  if (typeof window === "undefined") {
    throw new Error(
      "Scanner database can only be accessed in the browser."
    );
  }

  if (!dbPromise) {
    dbPromise = openDB<ScannerDB>(
      "freshers-gate-scanner",
      2,
      {
        upgrade(db, oldVersion, _newVersion, transaction) {
          /*
           * ==================================================
           * STUDENTS
           * ==================================================
           */

          if (
            !db.objectStoreNames.contains("students")
          ) {
            const students =
              db.createObjectStore("students", {
                keyPath: "id",
              });

            students.createIndex(
              "by-rollNo",
              "rollNo",
              {
                unique: true,
              }
            );

            students.createIndex(
              "by-status",
              "status"
            );

            students.createIndex(
              "by-qrTokenHash",
              "qrTokenHash",
              {
                unique: true,
              }
            );
          } else if (oldVersion < 2) {
            const nativeStudents =
              transaction.objectStore(
                "students"
              ) as unknown as IDBObjectStore;

            const hasQrIndex =
              Array.from(
                nativeStudents.indexNames
              ).includes(
                "by-qrTokenHash"
              );

            if (!hasQrIndex) {
              nativeStudents.createIndex(
                "by-qrTokenHash",
                "qrTokenHash",
                {
                  unique: true,
                }
              );
            }
          }

          /*
           * ==================================================
           * ENTRIES
           * ==================================================
           */

          if (
            !db.objectStoreNames.contains("entries")
          ) {
            const entries =
              db.createObjectStore("entries", {
                keyPath: "id",
              });

            entries.createIndex(
              "by-syncStatus",
              "syncStatus"
            );

            entries.createIndex(
              "by-scannedAt",
              "scannedAt"
            );

            entries.createIndex(
              "by-studentId",
              "studentId"
            );
          } else if (oldVersion < 2) {
            const nativeEntries =
              transaction.objectStore(
                "entries"
              ) as unknown as IDBObjectStore;

            const hasStudentIndex =
              Array.from(
                nativeEntries.indexNames
              ).includes(
                "by-studentId"
              );

            if (!hasStudentIndex) {
              nativeEntries.createIndex(
                "by-studentId",
                "studentId"
              );
            }
          }

          /*
           * ==================================================
           * METADATA
           * ==================================================
           */

          if (
            !db.objectStoreNames.contains(
              "metadata"
            )
          ) {
            db.createObjectStore("metadata", {
              keyPath: "key",
            });
          }
        },
      }
    );
  }

  return dbPromise;
}

/*
 * ============================================================
 * STUDENTS
 * ============================================================
 */

export async function replaceStudents(
  students: CachedStudent[]
) {
  const db = await getDatabase();

  const transaction = db.transaction(
    "students",
    "readwrite"
  );

  const store =
    transaction.objectStore("students");

  await store.clear();

  for (const student of students) {
    await store.put(student);
  }

  await transaction.done;
}

export async function getStudentByQrHash(
  qrTokenHash: string
) {
  const db = await getDatabase();

  return (
    (await db.getFromIndex(
      "students",
      "by-qrTokenHash",
      qrTokenHash
    )) ?? null
  );
}

export async function getCachedStudentCount() {
  const db = await getDatabase();

  return db.count("students");
}

export async function clearStudents() {
  const db = await getDatabase();

  await db.clear("students");
}

/*
 * ============================================================
 * ENTRIES
 * ============================================================
 */

export async function addPendingEntry(
  entry: PendingEntry
) {
  const db = await getDatabase();

  await db.put("entries", entry);
}

export async function getPendingEntries() {
  const db = await getDatabase();

  return db.getAllFromIndex(
    "entries",
    "by-syncStatus",
    "PENDING"
  );
}

export async function updateEntry(
  entry: PendingEntry
) {
  const db = await getDatabase();

  await db.put("entries", entry);
}

export async function getPendingEntryCount() {
  const db = await getDatabase();

  return db.countFromIndex(
    "entries",
    "by-syncStatus",
    "PENDING"
  );
}

/*
 * ============================================================
 * LOCAL ENTRY CHECK
 * ============================================================
 */

export async function hasLocalEntryForStudent(
  studentId: string
) {
  const db = await getDatabase();

  const entries =
    await db.getAllFromIndex(
      "entries",
      "by-studentId",
      studentId
    );

  return entries.some(
    (entry) =>
      entry.result === "ALLOWED" &&
      entry.syncStatus !== "FAILED"
  );
}

/*
 * ============================================================
 * ATOMIC LOCAL ENTRY CLAIM
 *
 * This is the important part.
 *
 * Check + ALLOWED entry creation happen inside
 * the same IndexedDB read/write transaction.
 * ============================================================
 */

export async function claimLocalEntry(
  entry: PendingEntry
): Promise<{
  allowed: boolean;
  existingEntry: PendingEntry | null;
}> {
  if (!entry.studentId) {
    throw new Error(
      "Cannot claim a local entry without studentId."
    );
  }

  const db = await getDatabase();

  const transaction = db.transaction(
    "entries",
    "readwrite"
  );

  const store =
    transaction.objectStore("entries");

  const index =
    store.index("by-studentId");

  const existingEntries =
    await index.getAll(entry.studentId);

  const existingAllowed =
    existingEntries.find(
      (existing) =>
        existing.result === "ALLOWED" &&
        existing.syncStatus !== "FAILED"
    ) ?? null;

  /*
   * Student already has an allowed entry.
   */
  if (existingAllowed) {
    await transaction.done;

    return {
      allowed: false,
      existingEntry: existingAllowed,
    };
  }

  /*
   * No previous successful entry exists.
   *
   * Claim the student immediately inside the
   * same transaction.
   */
  await store.put(entry);

  await transaction.done;

  return {
    allowed: true,
    existingEntry: null,
  };
}

/*
 * ============================================================
 * METADATA
 * ============================================================
 */

export async function setMetadata(
  key: string,
  value: string
) {
  const db = await getDatabase();

  await db.put("metadata", {
    key,
    value,
  });
}

export async function getMetadata(
  key: string
) {
  const db = await getDatabase();

  const result = await db.get(
    "metadata",
    key
  );

  return result?.value ?? null;
}