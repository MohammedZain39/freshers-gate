import { getGateDB } from "./db";

const SESSION_KEY = "gate-session";

export type LocalGateSession = {
  id: string;
  name: string;
  role: "ADMIN" | "SCANNER";
  authenticatedAt: string;
};

export async function saveLocalGateSession(
  session: LocalGateSession
) {
  const db = await getGateDB();

  await db.put("meta", {
    key: SESSION_KEY,
    value: JSON.stringify(session),
  });
}

export async function getLocalGateSession() {
  const db = await getGateDB();

  const record = await db.get(
    "meta",
    SESSION_KEY
  );

  if (!record) {
    return null;
  }

  try {
    return JSON.parse(
      record.value
    ) as LocalGateSession;
  } catch {
    return null;
  }
}

export async function clearLocalGateSession() {
  const db = await getGateDB();

  await db.delete(
    "meta",
    SESSION_KEY
  );
}