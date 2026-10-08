export async function hashQrToken(
  token: string
): Promise<string> {
  const data = new TextEncoder().encode(token);

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
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}