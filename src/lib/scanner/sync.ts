import {
  replaceStudents,
  setMetadata,
  type CachedStudent,
} from "./db";

const LAST_SYNC_KEY =
  "lastStudentSync";

export async function syncStudents() {
  const response = await fetch(
    "/api/scanner/sync",
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    let message =
      "Scanner synchronization failed.";

    try {
      const data =
        await response.json();

      if (data.error) {
        message = data.error;
      }
    } catch {
      // Ignore invalid response.
    }

    throw new Error(message);
  }

  const data = await response.json();

  if (
    !data.success ||
    !Array.isArray(data.students)
  ) {
    throw new Error(
      "Invalid scanner sync response."
    );
  }

  const students: CachedStudent[] =
    data.students;

  await replaceStudents(students);

  await setMetadata(
    LAST_SYNC_KEY,
    data.syncedAt
  );

  return {
    total: students.length,
    syncedAt: data.syncedAt as string,
  };
}

export async function getLastSyncTime() {
  const { getMetadata } =
    await import("./db");

  return getMetadata(
    LAST_SYNC_KEY
  );
}