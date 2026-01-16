import type { Context, Next } from "hono";
import { verifyIdToken, extendTokenCacheTTL } from "../services/firebase";
import { getSubscriptionHelper, getTestMode } from "./rateLimit";
import { checkAndRecordAccess } from "../services/access";
import { errorResponse } from "@sudobility/sudojo_types";
import { isAdminEmail } from "./auth";

// Admin tokens cached for 100 hours (admins are trusted, reduce API calls)
const ADMIN_TOKEN_CACHE_TTL_MS = 100 * 60 * 60 * 1000;

export function createAccessControlMiddleware(endpoint: string) {
  return async (c: Context, next: Next) => {
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
      const decodedToken = await verifyIdToken(token);
      const userId = decodedToken.uid;

      // Store user info in context for later use
      c.set("firebaseUser", decodedToken);

      // Check if user is an admin (bypass subscription check)
      if (isAdminEmail(decodedToken.email)) {
        // Extend cache TTL for admin tokens to 100 hours
        extendTokenCacheTTL(token, ADMIN_TOKEN_CACHE_TTL_MS);
        await next();
        return;
      }

      // Check if user has subscription using SubscriptionHelper
      const subHelper = getSubscriptionHelper();
      if (subHelper) {
        try {
          const testMode = getTestMode(c);
          const subscriptionInfo = await subHelper.getSubscriptionInfo(userId, testMode);
          // Check if user has any active entitlements (non-empty array means they have a subscription)
          if (subscriptionInfo.entitlements.length > 0) {
            // Subscriber has unlimited access
            await next();
            return;
          }
        } catch (_subscriptionError) {
          // If RevenueCat fails, continue with access check
          console.error("RevenueCat check failed:", _subscriptionError);
        }
      }

      // Non-subscriber: check daily access limit
      const { granted, remaining } = await checkAndRecordAccess(
        userId,
        endpoint
      );
      if (!granted) {
        return c.json(
          {
            success: false,
            error: "Daily limit reached",
            message:
              "You've reached your daily puzzle limit. Subscribe to unlock unlimited puzzles and support the app.",
            action: {
              type: "subscription_required",
              options: ["subscribe", "restore_purchase"],
            },
            timestamp: new Date().toISOString(),
          },
          402
        );
      }

      // Add remaining access count to response headers
      c.header("X-Daily-Remaining", remaining.toString());

      await next();
    } catch (_error) {
      return c.json(errorResponse("Invalid or expired Firebase token"), 401);
    }
  };
}
