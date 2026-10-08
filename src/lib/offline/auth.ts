"use client";

import { getGateDB } from "./db";

const OFFLINE_AUTH_KEY = "offline-auth";

type OfflineAuth = {
  adminId: string;
  name: string;
  role: "ADMIN" | "SCANNER";
  salt: string;
  verifier: string;
  createdAt: string;
};

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string) {
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []
  );

  return bytes.buffer;
}

async function deriveVerifier(
  password: string,
  salt: string
) {
  const encoder = new TextEncoder();

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt),
        iterations: 150000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

  return bufferToHex(bits);
}

export async function saveOfflineAuth(
  password: string,
  admin: {
    id: string;
    name: string;
    role: "ADMIN" | "SCANNER";
  }
) {
  const saltBytes =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  const salt =
    bufferToHex(saltBytes.buffer);

  const verifier =
    await deriveVerifier(
      password,
      salt
    );

  const auth: OfflineAuth = {
    adminId: admin.id,
    name: admin.name,
    role: admin.role,
    salt,
    verifier,
    createdAt:
      new Date().toISOString(),
  };

  const db = await getGateDB();

  await db.put("meta", {
    key: OFFLINE_AUTH_KEY,
    value: JSON.stringify(auth),
  });
}

export async function offlineLogin(
  password: string
) {
  const db = await getGateDB();

  const record =
    await db.get(
      "meta",
      OFFLINE_AUTH_KEY
    );

  if (!record) {
    return null;
  }

  let auth: OfflineAuth;

  try {
    auth = JSON.parse(
      record.value
    ) as OfflineAuth;
  } catch {
    return null;
  }

  const verifier =
    await deriveVerifier(
      password,
      auth.salt
    );

  if (verifier !== auth.verifier) {
    return null;
  }

  return {
    id: auth.adminId,
    name: auth.name,
    role: auth.role,
  };
}

export async function clearOfflineAuth() {
  const db = await getGateDB();

  await db.delete(
    "meta",
    OFFLINE_AUTH_KEY
  );
}

export async function hasOfflineAuth() {
  const db = await getGateDB();

  const record =
    await db.get(
      "meta",
      OFFLINE_AUTH_KEY
    );

  return Boolean(record);
}