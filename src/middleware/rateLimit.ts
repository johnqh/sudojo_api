import type { Context, Next } from "hono";
import {
  createRateLimitMiddleware,
  RateLimitRouteHandler,
  EntitlementHelper,
  RateLimitChecker,
  type RateLimitsConfig,
} from "@sudobility/ratelimit_service";
import { SubscriptionHelper } from "@sudobility/subscription_service";
import { db, rateLimitCounters } from "../db";
import { getEnv, getRequiredEnv } from "../lib/env-helper";
import { isSiteAdmin } from "../services/firebase";

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

export const entitlementDisplayNames: Record<string, string> = {
  none: "Free",
  sudojo: "Sudojo",
  pro: "Pro",
};

// Lazy-initialized instances to avoid requiring env vars at module load time
let _subscriptionHelper: SubscriptionHelper | null = null;
let _entitlementHelper: EntitlementHelper | null = null;
let _rateLimitChecker: RateLimitChecker | null = null;
let _rateLimitRouteHandler: RateLimitRouteHandler | null = null;
let _rateLimitMiddleware: ReturnType<typeof createRateLimitMiddleware> | null =
  null;

/**
 * Get subscription helper (singleton, lazily initialized).
 * Uses single API key - testMode is passed to getSubscriptionInfo to filter sandbox purchases.
 */
export function getSubscriptionHelper(): SubscriptionHelper | null {
  const apiKey = getEnv("REVENUECAT_API_KEY");
  if (!apiKey) return null;
  if (!_subscriptionHelper) {
    _subscriptionHelper = new SubscriptionHelper({ revenueCatApiKey: apiKey });
  }
  return _subscriptionHelper;
}

export function getEntitlementHelper(): EntitlementHelper {
  if (!_entitlementHelper) {
    _entitlementHelper = new EntitlementHelper(rateLimitsConfig);
  }
  return _entitlementHelper;
}

export function getRateLimitChecker(): RateLimitChecker {
  if (!_rateLimitChecker) {
    _rateLimitChecker = new RateLimitChecker({
      db: db as any,
      table: rateLimitCounters as any,
    });
  }
  return _rateLimitChecker;
}

/**
 * Get the route handler for rate limit endpoints.
 * Lazily initialized to avoid requiring REVENUECAT_API_KEY at module load time.
 * Uses single API key - testMode is passed to individual methods to filter sandbox purchases.
 */
export function getRateLimitRouteHandler(): RateLimitRouteHandler {
  if (!_rateLimitRouteHandler) {
    _rateLimitRouteHandler = new RateLimitRouteHandler({
      revenueCatApiKey: getRequiredEnv("REVENUECAT_API_KEY"),
      rateLimitsConfig,
      db: db as any,
      rateLimitsTable: rateLimitCounters as any,
      entitlementDisplayNames,
    });
  }
  return _rateLimitRouteHandler;
}

/**
 * Get the rate limit middleware for sudojo_api.
 * Lazily initialized to avoid requiring REVENUECAT_API_KEY at module load time.
 * Uses single API key - testMode is extracted from URL query parameter to filter sandbox purchases.
 */
function getRateLimitMiddleware(): ReturnType<typeof createRateLimitMiddleware> {
  if (!_rateLimitMiddleware) {
    _rateLimitMiddleware = createRateLimitMiddleware({
      revenueCatApiKey: getRequiredEnv("REVENUECAT_API_KEY"),
      rateLimitsConfig,
      // Cast to any to avoid type conflicts between different drizzle-orm/hono instances
      // when using bun link for local development
      db: db as any,
      rateLimitsTable: rateLimitCounters as any,
      getUserId: (c: any) => {
        const firebaseUser = c.get("firebaseUser");
        if (!firebaseUser) {
          throw new Error("Firebase user not found in context");
        }
        return firebaseUser.uid;
      },
      shouldSkip: (c: any) => {
        // Skip rate limiting for admin users
        const firebaseUser = c.get("firebaseUser");
        if (!firebaseUser) return false;
        return isSiteAdmin(firebaseUser.email);
      },
      getTestMode: (c: any) => {
        const url = new URL(c.req.url);
        return url.searchParams.get("testMode") === "true";
      },
    });
  }
  return _rateLimitMiddleware;
}

/**
 * Extract testMode from URL query parameter.
 * Exported for use by route handlers that need to pass testMode to RateLimitRouteHandler methods.
 */
export function getTestMode(c: Context): boolean {
  const url = new URL(c.req.url);
  return url.searchParams.get("testMode") === "true";
}

/**
 * Wrapper for rate limit middleware that handles type compatibility.
 * Use this for endpoints that need rate limiting.
 * Automatically detects testMode from URL query parameter.
 */
export async function rateLimitHandler(c: Context, next: Next) {
  // Cast to any to avoid type conflicts between different hono instances
  const middleware = getRateLimitMiddleware();
  await middleware(c as any, next as any);
}

/**
 * Combined middleware that applies Firebase auth then rate limiting.
 * Use this for endpoints that need both authentication and rate limiting.
 * Note: firebaseAuthMiddleware should be applied before this to populate firebaseUser in context.
 */
export async function authAndRateLimitMiddleware(c: Context, next: Next) {
  // Skip rate limiting for admin users
  const firebaseUser = (c as any).get("firebaseUser");
  if (firebaseUser && isSiteAdmin(firebaseUser.email)) {
    await next();
    return;
  }

  // For non-admin requests, apply rate limiting
  // Cast to any to avoid type conflicts between different hono instances
  const middleware = getRateLimitMiddleware();
  await middleware(c as any, next as any);
}
