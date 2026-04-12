import { randomBytes, createCipheriv } from "crypto";
import { getEnv } from "./env-helper";

/**
 * Encrypt a solution string using AES-256-GCM.
 *
 * @returns `"enc:" + base64(nonce + ciphertext + authTag)`
 */
export function encryptSolution(solution: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);

  const ciphertext = Buffer.concat([
    cipher.update(solution, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([nonce, ciphertext, authTag]);
  return `enc:${payload.toString("base64")}`;
}

/**
 * Recursively walk an object/array and encrypt any `solution` string field.
 * Returns a new object (does not mutate the original).
 */
export function encryptSolutionFields(data: unknown, keyHex: string): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => encryptSolutionFields(item, keyHex));
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (key === "solution" && typeof obj[key] === "string") {
        result[key] = encryptSolution(obj[key] as string, keyHex);
      } else {
        result[key] = encryptSolutionFields(obj[key], keyHex);
      }
    }
    return result;
  }

  return data;
}

/**
 * Get the solution encryption key from environment, or undefined if not set.
 */
export function getSolutionEncryptionKey(): string | undefined {
  return getEnv("SOLUTION_ENCRYPTION_KEY");
}
