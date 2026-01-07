import type { Context, Next } from "hono";
import {
  createRateLimitMiddleware,
  RateLimitRouteHandler,
  type RateLimitsConfig,
} from "@sudobility/ratelimit_service";
import { db, rateLimitCounters } from "../db";
import { getRequiredEnv } from "../lib/env-helper";
import { isAdminEmail } from "./auth";

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
    // Skip rate limiting for admin users
    const firebaseUser = (c as any).get("firebaseUser");
    if (!firebaseUser) return false;
    return isAdminEmail(firebaseUser.email);
  },
});

/**
 * Combined middleware that applies Firebase auth then rate limiting.
 * Use this for endpoints that need both authentication and rate limiting.
 * Note: firebaseAuthMiddleware should be applied before this to populate firebaseUser in context.
 */
export async function authAndRateLimitMiddleware(c: Context, next: Next) {
  // Skip rate limiting for admin users
  const firebaseUser = (c as any).get("firebaseUser");
  if (firebaseUser && isAdminEmail(firebaseUser.email)) {
    await next();
    return;
  }

  // For non-admin requests, apply rate limiting
  // Cast to any to avoid type conflicts between different hono instances
  await rateLimitMiddleware(c as any, next as any);
}
