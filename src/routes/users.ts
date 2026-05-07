/**
 * @fileoverview User routes for Sudojo API
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import { userIdParamSchema } from "../schemas";
import { NONE_ENTITLEMENT, UserStatus } from "@sudobility/types";
import { getSubscriptionHelper, getTestMode } from "../middleware/subscription";
import {
  getUserInfo,
  deleteUserAccount,
  getAppleSignInConfig,
} from "../services/firebase";
import { db, userStats } from "../db";
import {
  successResponse,
  errorResponse,
  type SubscriptionResult,
} from "@sudobility/sudojo_types";

const usersRouter = new Hono();

/**
 * Check if a user account is active. Returns the status or null if no record.
 */
async function getUserStatus(userId: string): Promise<string | null> {
  const rows = await db
    .select({ status: userStats.status })
    .from(userStats)
    .where(eq(userStats.userId, userId))
    .limit(1);
  return rows[0]?.status ?? null;
}

/**
 * GET /users/:userId
 *
 * Get user information including siteAdmin status.
 * Requires the Firebase token to match the requested userId.
 * Returns 403 if token doesn't match, user not found, or account is deleted.
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

    // Check account status
    const status = await getUserStatus(userId);
    if (status === UserStatus.DELETED) {
      return c.json(errorResponse("Account has been deleted"), 403);
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

    // Check account status
    const status = await getUserStatus(userId);
    if (status === UserStatus.DELETED) {
      return c.json(errorResponse("Account has been deleted"), 403);
    }

    const subHelper = getSubscriptionHelper();
    if (!subHelper) {
      return c.json(errorResponse("Subscription service not configured"), 500);
    }

    try {
      const testMode = getTestMode(c);
      const subscriptionInfo = await subHelper.getSubscriptionInfo(
        userId,
        testMode
      );
      // Transform to match the expected response format
      // Date fields are serialized to ISO strings by c.json()
      const subscriptionResult = {
        hasSubscription:
          subscriptionInfo.entitlements.length > 0 &&
          !subscriptionInfo.entitlements.includes(NONE_ENTITLEMENT),
        entitlements: subscriptionInfo.entitlements,
        subscriptionStartedAt: subscriptionInfo.subscriptionStartedAt,
        platform: subscriptionInfo.platform,
        productIdentifier: subscriptionInfo.productIdentifier,
        expiresDate: subscriptionInfo.expiresDate,
        sandbox: subscriptionInfo.sandbox,
        store: subscriptionInfo.store,
        willRenew: subscriptionInfo.willRenew,
        managementUrl: subscriptionInfo.managementUrl,
      } as SubscriptionResult;
      return c.json(successResponse(subscriptionResult));
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return c.json(errorResponse("Failed to fetch subscription status"), 500);
    }
  }
);

/**
 * DELETE /users/:userId
 *
 * Delete (soft-delete) a user account.
 * - Rejects if user has an active subscription (409)
 * - Sets account status to 'deleted' in DB
 * - Revokes OAuth tokens (Google/Apple) if provided
 * - Deletes the Firebase user record (removes all PII)
 *
 * Request body (optional JSON):
 * - googleAccessToken: Google OAuth access token for revocation
 * - appleAuthorizationCode: Apple authorization code for token revocation
 */
usersRouter.delete(
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

    // Check if already deleted
    const status = await getUserStatus(userId);
    if (status === UserStatus.DELETED) {
      return c.json(errorResponse("Account has already been deleted"), 410);
    }

    // Check for active subscription
    const subHelper = getSubscriptionHelper();
    if (subHelper) {
      try {
        const testMode = getTestMode(c);
        const subscriptionInfo = await subHelper.getSubscriptionInfo(
          userId,
          testMode
        );
        const hasActiveSubscription =
          subscriptionInfo.entitlements.length > 0 &&
          !subscriptionInfo.entitlements.includes(NONE_ENTITLEMENT);

        if (hasActiveSubscription) {
          return c.json(
            errorResponse(
              "Please cancel your subscription before deleting your account"
            ),
            409
          );
        }
      } catch (error) {
        console.error("Error checking subscription for deletion:", error);
        // Continue with deletion if subscription check fails
      }
    }

    // Parse optional provider tokens from request body
    let googleAccessToken: string | undefined;
    let appleAuthorizationCode: string | undefined;
    try {
      const body = await c.req.json();
      googleAccessToken = body?.googleAccessToken;
      appleAuthorizationCode = body?.appleAuthorizationCode;
    } catch {
      // No body or invalid JSON - proceed without provider tokens
    }

    // Mark account as deleted in DB (upsert in case no record exists)
    const existing = await db
      .select({ userId: userStats.userId })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userStats)
        .set({ status: UserStatus.DELETED, updatedAt: new Date() })
        .where(eq(userStats.userId, userId));
    } else {
      await db.insert(userStats).values({
        userId,
        status: UserStatus.DELETED,
      });
    }

    // Delete Firebase user and revoke OAuth tokens
    try {
      const appleConfig = getAppleSignInConfig();
      await deleteUserAccount(userId, {
        googleAccessToken,
        appleAuthorizationCode,
        appleConfig: appleConfig ?? undefined,
      });
    } catch (error) {
      console.error("Error deleting Firebase user:", error);
      // Account is already marked as deleted in DB, so we don't revert
      // The Firebase user may need manual cleanup
    }

    return c.json(successResponse({ deleted: true }));
  }
);

export default usersRouter;
