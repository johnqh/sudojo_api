import type { Context, Next } from "hono";
import { getRequiredEnv } from "../lib/env-helper";

const API_ACCESS_TOKEN = getRequiredEnv("API_ACCESS_TOKEN");

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return c.json(
      { error: "Invalid authorization format. Use: Bearer <token>" },
      401
    );
  }

  if (token !== API_ACCESS_TOKEN) {
    return c.json({ error: "Invalid access token" }, 403);
  }

  await next();
}
