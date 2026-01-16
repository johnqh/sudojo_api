import type { Context, Next } from "hono";
import { createAdminChecker } from "@sudobility/auth_lib";
import { getEnv } from "../lib/env-helper";
import { verifyIdToken } from "../services/firebase";
import { errorResponse } from "@sudobility/sudojo_types";

// Admin tokens cached for 100 hours (admins are trusted, reduce API calls)
const ADMIN_TOKEN_CACHE_TTL_MS = 100 * 60 * 60 * 1000;

// Admin email checker (parses ADMIN_EMAILS env var once)
export const isAdminEmail = createAdminChecker(getEnv("ADMIN_EMAILS"));

/**
 * Middleware that requires Firebase authentication and admin email.
 * Checks if user's email is in ADMIN_EMAILS environment variable.
 */
export async function adminMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json(errorResponse("Authorization header required"), 401);
  }

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return c.json(
      errorResponse("Invalid authorization format. Use: Bearer <token>"),
      401
    );
  }

  try {
    const decodedToken = await verifyIdToken(token, ADMIN_TOKEN_CACHE_TTL_MS);

    if (!isAdminEmail(decodedToken.email)) {
      return c.json(errorResponse("Admin access required"), 403);
    }

    // Store user info in context for later use
    c.set("firebaseUser", decodedToken);

    await next();
  } catch (_error) {
    return c.json(errorResponse("Invalid or expired Firebase token"), 401);
  }
}
