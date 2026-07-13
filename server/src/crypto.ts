import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * SPEC-017 G1. AES-256-GCM at-rest encryption for BYO vendor keys.
 * Format: enc:v1:<iv b64>:<tag b64>:<ciphertext b64>. KEK = 32 bytes, base64 (env/Secret Manager).
 * decrypt() NEVER throws: tampered/undecryptable enc-values → null (callers fail closed to guided);
 * non-enc values are returned as-is (R3 legacy plaintext tolerance).
 */
const PREFIX = "enc:v1:";

export function encrypt(plain: string, kekB64: string): string {
  const kek = Buffer.from(kekB64, "base64");
  if (kek.length !== 32) throw new Error("KEY_ENCRYPTION_KEY must be 32 bytes (base64)");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(stored: string, kekB64: string): string | null {
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext (R3)
  try {
    const [iv, tag, ct] = stored.slice(PREFIX.length).split(":");
    const kek = Buffer.from(kekB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", kek, Buffer.from(iv!, "base64"));
    decipher.setAuthTag(Buffer.from(tag!, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ct!, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // tamper / wrong key → fail closed
  }
}
