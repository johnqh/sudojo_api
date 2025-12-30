import type { Context, Next } from "hono";
import {
  createRateLimitMiddleware,
  RateLimitRouteHandler,
  type RateLimitsConfig,
} from "@sudobility/ratelimit_service";
import { db, rateLimitCounters } from "../db";
import { getRequiredEnv } from "../lib/env-helper";

/**
 * Rate limit configuration for sudojo_api
 *
 * - none: Free tier users (no subscription)
 * - sudojo: Users with sudojo entitlement
 * - pro: Pro users with unlimited access
 */
export const rateLimitsConfig: RateLimitsConfig = {
  none: { hourly: 5, daily: 20, monthly: 100 },
  sudojo: { hourly: 50, daily: 500, monthly: 5000 },
  pro: { hourly: undefined, daily: undefined, monthly: undefined },
};

/**
 * Route handler for rate limit endpoints.
 */
export const rateLimitRouteHandler = new RateLimitRouteHandler({
  revenueCatApiKey: getRequiredEnv("REVENUECAT_API_KEY"),
  rateLimitsConfig,
  db: db as any,
  rateLimitsTable: rateLimitCounters as any,
  entitlementDisplayNames: {
    none: "Free",
    sudojo: "Sudojo",
    pro: "Pro",
  },
});

/**
 * Create the rate limit middleware for sudojo_api.
 * This uses the subscription_service to check RevenueCat entitlements
 * and enforce rate limits.
 */
export const rateLimitMiddleware = createRateLimitMiddleware({
  revenueCatApiKey: getRequiredEnv("REVENUECAT_API_KEY"),
  rateLimitsConfig,
  // Cast to any to avoid type conflicts between different drizzle-orm instances
  db: db as any,
  rateLimitsTable: rateLimitCounters as any,
  getUserId: c => {
    const firebaseUser = (c as any).get("firebaseUser");
    if (!firebaseUser) {
      throw new Error("Firebase user not found in context");
    }
    return firebaseUser.uid;
  },
  shouldSkip: c => {
    // Skip rate limiting for admin API token
    const authHeader = (c as any).req.header("Authorization");
    if (!authHeader) return false;

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) return false;

    const apiAccessToken = process.env.API_ACCESS_TOKEN;
    return apiAccessToken !== undefined && token === apiAccessToken;
  },
});

/**
 * Combined middleware that applies Firebase auth then rate limiting.
 * Use this for endpoints that need both authentication and rate limiting.
 */
export async function authAndRateLimitMiddleware(c: Context, next: Next) {
  // First check for admin token (skip all checks)
  const authHeader = c.req.header("Authorization");
  if (authHeader) {
    const [type, token] = authHeader.split(" ");
    if (type === "Bearer" && token) {
      const apiAccessToken = process.env.API_ACCESS_TOKEN;
      if (apiAccessToken && token === apiAccessToken) {
        await next();
        return;
      }
    }
  }

  // For non-admin requests, apply rate limiting
  // Note: firebaseAuthMiddleware should be applied before this
  // Cast to any to avoid type conflicts between different hono instances
  await rateLimitMiddleware(c as any, next as any);
}
