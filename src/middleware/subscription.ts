import type { Context } from "hono";
import { SubscriptionHelper } from "@sudobility/subscription_service";
import { getEnv } from "../lib/env-helper";

// Lazy-initialized instance to avoid requiring env vars at module load time
let _subscriptionHelper: SubscriptionHelper | null = null;

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

/**
 * Extract testMode from URL query parameter.
 * Exported for use by route handlers that need to pass testMode to subscription methods.
 */
export function getTestMode(c: Context): boolean {
  const url = new URL(c.req.url);
  return url.searchParams.get("testMode") === "true";
}
