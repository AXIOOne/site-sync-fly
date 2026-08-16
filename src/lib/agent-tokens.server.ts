import { createHash, randomBytes } from "crypto";

/** Device tokens are shown once at issue time and only ever stored as a SHA-256 hash. */
export function generateDeviceToken(): { token: string; hash: string; preview: string } {
  const token = `fa_${randomBytes(24).toString("hex")}`;
  return { token, hash: hashDeviceToken(token), preview: `${token.slice(0, 9)}…${token.slice(-4)}` };
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}
