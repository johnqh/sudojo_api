/**
 * @fileoverview Optional Firebase authentication for GET /solver/solve.
 *
 * Hint limits are NOT enforced anywhere: every caller gets every hint level.
 * The route-level tier check was removed in 4e8de9b (March 2026). The code that
 * still computed tiers (`hintAccess.ts`, `HINT_LEVEL_LIMITS`) was deleted
 * because nothing read it. This middleware keeps only the behaviour the route
 * relies on:
 *
 * - No Authorization header, or one that is not `Bearer <token>`: anonymous.
 * - A valid Bearer token sets `firebaseUser`, which the route uses to award
 *   hint points against the caller's active /play session.
 * - An invalid or expired token returns 401 `AUTH_TOKEN_INVALID`, so clients
 *   refresh the token and retry.
 * - A request carrying the configured `ADMIN_API_KEY` (`X-API-Key` header or
 *   `?api_key=`) skips token verification and is treated as anonymous. Kept
 *   so behaviour is unchanged; it used to also lift the hint limit.
 */

import type { Context, Next } from "hono";
import { verifyIdToken } from "../services/firebase";
import { getEnv } from "../lib/env-helper";

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header("X-API-Key") ?? c.req.query("api_key");
  const configuredKey = getEnv("ADMIN_API_KEY");
  if (configuredKey && apiKey === configuredKey) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");

    if (type === "Bearer" && token) {
      try {
        const decodedToken = await verifyIdToken(token);
        c.set("firebaseUser", decodedToken);
      } catch (error) {
        // Invalid/expired token - return 401 to trigger client token refresh
        console.error("Token verification failed:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
        }
        return c.json(
          {
            success: false,
            error: "Invalid or expired token",
            code: "AUTH_TOKEN_INVALID",
          },
          401
        );
      }
    }
  }

  await next();
}
