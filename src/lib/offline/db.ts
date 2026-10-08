import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OfflineStudent = {
  id: string;
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
  status: "ACTIVE" | "INACTIVE";
  qrTokenHash: string;
  enteredAt: string | null;
};

export type OfflineScan = {
  id: string;
  studentId: string;
  qrTokenHash: string;
  scannedAt: string;
  synced: boolean;
};

interface FreshersGateDB extends DBSchema {
  students: {
    key: string;
    value: OfflineStudent;
    indexes: {
      "by-qr-hash": string;
      "by-roll-no": string;
    };
  };

  scans: {
    key: string;
    value: OfflineScan;
    indexes: {
      "by-synced": number;
      "by-student": string;
    };
  };

  meta: {
    key: string;
    value: {
      key: string;
      value: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<FreshersGateDB>> | null = null;

export function getGateDB() {
  if (!dbPromise) {
    dbPromise = openDB<FreshersGateDB>(
      "freshers-gate",
      1,
      {
        upgrade(db) {
          const students = db.createObjectStore(
            "students",
            {
              keyPath: "id",
            }
          );

          students.createIndex(
            "by-qr-hash",
            "qrTokenHash",
            { unique: true }
          );

          students.createIndex(
            "by-roll-no",
            "rollNo",
            { unique: true }
          );

          const scans = db.createObjectStore(
            "scans",
            {
              keyPath: "id",
            }
          );

          scans.createIndex(
            "by-synced",
            "synced"
          );

          scans.createIndex(
            "by-student",
            "studentId"
          );

          db.createObjectStore("meta", {
            keyPath: "key",
          });
        },
      }
    );
  }

  return dbPromise;
}