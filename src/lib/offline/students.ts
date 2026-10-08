import {
  getGateDB,
  type OfflineStudent,
} from "./db";

export type { OfflineStudent } from "./db";

export async function saveStudents(
  students: OfflineStudent[]
) {
  const db = await getGateDB();

  const tx = db.transaction(
    "students",
    "readwrite"
  );

  for (const student of students) {
    await tx.store.put(student);
  }

  await tx.done;
}

export async function getStudentByQrHash(
  qrTokenHash: string
) {
  const db = await getGateDB();

  return db
    .transaction("students")
    .store
    .index("by-qr-hash")
    .get(qrTokenHash);
}

export async function markStudentEntered(
  studentId: string,
  enteredAt: string
) {
  const db = await getGateDB();

  const student = await db
    .transaction("students")
    .store
    .get(studentId);

  if (!student) {
    return false;
  }

  if (student.enteredAt) {
    return false;
  }

  student.enteredAt = enteredAt;

  await db.put("students", student);

  return true;
}

export async function getAllStudents() {
  const db = await getGateDB();

  return db.getAll("students");
}