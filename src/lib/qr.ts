import crypto from "crypto";

export function generateQrCredential() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashQrCredential(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}