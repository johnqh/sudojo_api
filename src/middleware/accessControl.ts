import type { Context, Next } from "hono";
import { verifyIdToken, isAnonymousUser } from "../services/firebase";
import { getSubscriberEntitlements } from "../services/revenuecat";
import { checkAndRecordAccess } from "../services/access";
import { errorResponse } from "@sudobility/sudojo_types";
import { getEnv } from "../lib/env-helper";

const API_ACCESS_TOKEN = getEnv("API_ACCESS_TOKEN");

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

    // Check if it's an API access token (for admin operations)
    if (API_ACCESS_TOKEN && token === API_ACCESS_TOKEN) {
      // Admin token - grant full access, skip Firebase and subscription checks
      await next();
      return;
    }

    try {
      const decodedToken = await verifyIdToken(token);

      if (isAnonymousUser(decodedToken)) {
        return c.json(
          {
            success: false,
            error: "Account required",
            message:
              "Please log in or create an account to access sudoku puzzles.",
            action: {
              type: "auth_required",
              options: ["login", "create_account"],
            },
            timestamp: new Date().toISOString(),
          },
          403
        );
      }

      const userId = decodedToken.uid;

      // Store user info in context for later use
      c.set("firebaseUser", decodedToken);

      // Check if user has subscription
      try {
        const subscription = await getSubscriberEntitlements(userId);
        if (subscription.hasSubscription) {
          // Subscriber has unlimited access
          await next();
          return;
        }
      } catch (_subscriptionError) {
        // If RevenueCat fails, continue with access check
        console.error("RevenueCat check failed:", _subscriptionError);
      }

      // Non-subscriber: check daily access limit
      const { granted, remaining } = await checkAndRecordAccess(userId, endpoint);
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
