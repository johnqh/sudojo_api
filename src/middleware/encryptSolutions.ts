import type { Context, Next } from "hono";
import {
  encryptSolutionFields,
  getSolutionEncryptionKey,
} from "../lib/solution-crypto";

/**
 * Hono middleware that encrypts `solution` fields in GET JSON responses.
 *
 * - Skips non-GET requests (POST/PUT/DELETE are admin writes)
 * - Skips if SOLUTION_ENCRYPTION_KEY is not configured (passthrough for dev)
 * - Parses the JSON response body, encrypts solution fields, and returns a new response
 */
export async function encryptSolutionsMiddleware(
  c: Context,
  next: Next
): Promise<void | Response> {
  await next();

  if (c.req.method !== "GET") return;

  const keyHex = getSolutionEncryptionKey();
  if (!keyHex) return;

  const contentType = c.res.headers.get("content-type");
  if (!contentType?.includes("application/json")) return;

  const body = await c.res.json();
  const encrypted = encryptSolutionFields(body, keyHex);

  c.res = new Response(JSON.stringify(encrypted), {
    status: c.res.status,
    headers: c.res.headers,
  });
}
