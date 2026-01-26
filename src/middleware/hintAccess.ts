/**
 * @fileoverview Middleware for hint access control based on subscription tier
 */

import type { Context, Next } from "hono";
import { verifyIdToken, isSiteAdmin } from "../services/firebase";
import { getSubscriptionHelper, getTestMode } from "./rateLimit";
import {
  type HintAccessUserState,
  type HintEntitlement,
  HINT_LEVEL_LIMITS,
} from "@sudobility/sudojo_types";

/** Entitlement identifiers */
const ENTITLEMENTS = {
  RED_BELT: "red_belt",
  BLUE_BELT: "blue_belt",
} as const;

export interface HintAccessContext {
  /** Maximum hint level the user can access */
  maxHintLevel: number;
  /** User's current state for error messaging */
  userState: HintAccessUserState;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** User's entitlements (if any) */
  entitlements: string[];
}

/**
 * Determines the required entitlement for a given hint level
 */
export function getRequiredEntitlement(hintLevel: number): HintEntitlement {
  if (hintLevel > HINT_LEVEL_LIMITS.blue_belt) {
    return "red_belt";
  }
  return "blue_belt";
}

/**
 * Middleware that determines user's hint access level.
 * Sets hintAccess context with maxHintLevel and userState.
 * Does NOT block requests - the route handler checks access after getting solver response.
 */
export async function hintAccessMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  // Default: anonymous user with free tier access
  let hintAccess: HintAccessContext = {
    maxHintLevel: HINT_LEVEL_LIMITS.free,
    userState: "anonymous",
    isAuthenticated: false,
    entitlements: [],
  };

  if (authHeader) {
    const [type, token] = authHeader.split(" ");

    if (type === "Bearer" && token) {
      try {
        const decodedToken = await verifyIdToken(token);

        // Store user info in context
        c.set("firebaseUser", decodedToken);
        hintAccess.isAuthenticated = true;

        // Check if site admin - unlimited access
        if (isSiteAdmin(decodedToken.email)) {
          hintAccess.maxHintLevel = Infinity;
          hintAccess.userState = "no_subscription"; // Not relevant for admins
          c.set("hintAccess", hintAccess);
          await next();
          return;
        }

        // Check subscription entitlements
        const subHelper = getSubscriptionHelper();
        if (subHelper) {
          try {
            const testMode = getTestMode(c);
            const subscriptionInfo = await subHelper.getSubscriptionInfo(
              decodedToken.uid,
              testMode
            );

            hintAccess.entitlements = subscriptionInfo.entitlements;

            // Check for red_belt (highest tier - unlimited)
            if (subscriptionInfo.entitlements.includes(ENTITLEMENTS.RED_BELT)) {
              hintAccess.maxHintLevel = HINT_LEVEL_LIMITS.red_belt;
              hintAccess.userState = "no_subscription"; // Has subscription
              c.set("hintAccess", hintAccess);
              await next();
              return;
            }

            // Check for blue_belt (mid tier - level 5 max)
            if (subscriptionInfo.entitlements.includes(ENTITLEMENTS.BLUE_BELT)) {
              hintAccess.maxHintLevel = HINT_LEVEL_LIMITS.blue_belt;
              hintAccess.userState = "insufficient_tier";
              c.set("hintAccess", hintAccess);
              await next();
              return;
            }

            // Authenticated but no subscription
            hintAccess.userState = "no_subscription";
          } catch (error) {
            console.error("RevenueCat check failed:", error);
            // On error, treat as no subscription
            hintAccess.userState = "no_subscription";
          }
        } else {
          // No subscription helper configured
          hintAccess.userState = "no_subscription";
        }
      } catch (error) {
        // Invalid token - treat as anonymous
        console.error("Token verification failed:", error);
        hintAccess.userState = "anonymous";
        hintAccess.isAuthenticated = false;
      }
    }
  }

  c.set("hintAccess", hintAccess);
  await next();
}
