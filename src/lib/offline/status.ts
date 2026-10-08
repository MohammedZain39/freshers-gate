import { getGateDB } from "./db";

export async function getLocalStudentCount() {
  const db = await getGateDB();

  return db.count("students");
}

export async function getLocalPendingScanCount() {
  const db = await getGateDB();

  return db
    .transaction("scans")
    .store
    .index("by-synced")
    .count(0);
}