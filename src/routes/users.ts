/**
 * @fileoverview User routes for Sudojo API
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import { userIdParamSchema } from "../schemas";
import { getSubscriptionHelper, getTestMode } from "../middleware/rateLimit";
import { getUserInfo } from "../services/firebase";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const usersRouter = new Hono();

/**
 * GET /users/:userId
 *
 * Get user information including siteAdmin status.
 * Requires the Firebase token to match the requested userId.
 * Returns 403 if token doesn't match or user not found.
 */
usersRouter.get(
  "/:userId",
  firebaseAuthMiddleware,
  zValidator("param", userIdParamSchema),
  async c => {
    const { userId } = c.req.valid("param");
    const tokenUserId = c.get("userId");

    // Verify the token belongs to the requested user
    if (tokenUserId !== userId) {
      return c.json(errorResponse("Token does not match requested user"), 403);
    }

    const userInfo = await getUserInfo(userId);

    if (!userInfo) {
      return c.json(errorResponse("User not found"), 403);
    }

    return c.json(successResponse(userInfo));
  }
);

/**
 * GET /users/:userId/subscriptions
 *
 * Get user subscriptions (requires Firebase auth).
 */
usersRouter.get(
  "/:userId/subscriptions",
  firebaseAuthMiddleware,
  zValidator("param", userIdParamSchema),
  async c => {
    const { userId } = c.req.valid("param");
    const firebaseUser = c.get("firebaseUser");

    // Ensure the authenticated user can only access their own subscription
    if (firebaseUser.uid !== userId) {
      return c.json(
        errorResponse("You can only access your own subscription"),
        403
      );
    }

    const subHelper = getSubscriptionHelper();
    if (!subHelper) {
      return c.json(errorResponse("Subscription service not configured"), 500);
    }

    try {
      const testMode = getTestMode(c);
      const subscriptionInfo = await subHelper.getSubscriptionInfo(userId, testMode);
      // Transform to match the expected response format
      const subscriptionResult = {
        hasSubscription: subscriptionInfo.entitlements.length > 0,
        entitlements: subscriptionInfo.entitlements,
        subscriptionStartedAt: subscriptionInfo.subscriptionStartedAt,
      };
      return c.json(successResponse(subscriptionResult));
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return c.json(errorResponse("Failed to fetch subscription status"), 500);
    }
  }
);

export default usersRouter;
