/**
 * @fileoverview Gamification routes for user stats and badges
 *
 * Handles:
 * - User stats retrieval
 * - Badge definitions (public)
 * - User badges listing
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import { adminMiddleware } from "../middleware/auth";
import {
  badgeDefinitionCreateSchema,
  badgeDefinitionUpdateSchema,
  badgeKeyParamSchema,
} from "../schemas";
import { db } from "../db";
import {
  userStats,
  userBadges,
  badgeDefinitions,
  pointTransactions,
} from "../db/schema";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const gamificationRouter = new Hono();

// =============================================================================
// Public Routes
// =============================================================================

/**
 * GET /gamification/badges
 *
 * Get all badge definitions (public).
 * Returns badge metadata for displaying in UI.
 */
gamificationRouter.get("/badges", async c => {
  try {
    const badges = await db
      .select()
      .from(badgeDefinitions)
      .orderBy(asc(badgeDefinitions.badgeType), asc(badgeDefinitions.requirementValue));

    return c.json(successResponse(badges));
  } catch (error) {
    console.error("Error fetching badge definitions:", error);
    return c.json(errorResponse("Failed to fetch badge definitions"), 500);
  }
});

// =============================================================================
// Authenticated Routes
// =============================================================================

/**
 * GET /gamification/stats
 *
 * Get the authenticated user's gamification stats including earned badges.
 */
gamificationRouter.get("/stats", firebaseAuthMiddleware, async c => {
  const userId = c.get("userId");

  try {
    // Get user stats (or return defaults if not exists)
    const statsResult = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userId, userId));

    const stats = statsResult[0] ?? {
      totalPoints: 0,
      userLevel: 0,
      gamesCompleted: 0,
    };

    // Get user's earned badges with full badge info
    const earnedBadges = await db
      .select({
        badgeKey: userBadges.badgeKey,
        earnedAt: userBadges.earnedAt,
        title: badgeDefinitions.title,
        description: badgeDefinitions.description,
        iconUrl: badgeDefinitions.iconUrl,
        badgeType: badgeDefinitions.badgeType,
        requirementValue: badgeDefinitions.requirementValue,
      })
      .from(userBadges)
      .innerJoin(
        badgeDefinitions,
        eq(userBadges.badgeKey, badgeDefinitions.badgeKey)
      )
      .where(eq(userBadges.userId, userId));

    return c.json(
      successResponse({
        totalPoints: stats.totalPoints,
        userLevel: stats.userLevel,
        gamesCompleted: stats.gamesCompleted,
        badges: earnedBadges,
      })
    );
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return c.json(errorResponse("Failed to fetch user stats"), 500);
  }
});

/**
 * GET /gamification/history
 *
 * Get the authenticated user's point transaction history.
 * Paginated with limit/offset.
 */
gamificationRouter.get("/history", firebaseAuthMiddleware, async c => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);
  const offset = parseInt(c.req.query("offset") ?? "0");

  try {
    const transactions = await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId))
      .orderBy(asc(pointTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json(successResponse(transactions));
  } catch (error) {
    console.error("Error fetching point history:", error);
    return c.json(errorResponse("Failed to fetch point history"), 500);
  }
});

// =============================================================================
// Admin Routes - Badge Management
// =============================================================================

/**
 * POST /gamification/badges
 *
 * Create a new badge definition (admin only).
 */
gamificationRouter.post(
  "/badges",
  adminMiddleware,
  zValidator("json", badgeDefinitionCreateSchema),
  async c => {
    const body = c.req.valid("json");

    try {
      const newBadge = await db
        .insert(badgeDefinitions)
        .values({
          badgeType: body.badgeType,
          badgeKey: body.badgeKey,
          title: body.title,
          description: body.description,
          iconUrl: body.iconUrl,
          requirementValue: body.requirementValue,
        })
        .returning();

      return c.json(successResponse(newBadge[0]), 201);
    } catch (error) {
      console.error("Error creating badge definition:", error);
      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes("unique")) {
        return c.json(errorResponse("Badge key already exists"), 409);
      }
      return c.json(errorResponse("Failed to create badge definition"), 500);
    }
  }
);

/**
 * PUT /gamification/badges/:badgeKey
 *
 * Update a badge definition (admin only).
 */
gamificationRouter.put(
  "/badges/:badgeKey",
  adminMiddleware,
  zValidator("param", badgeKeyParamSchema),
  zValidator("json", badgeDefinitionUpdateSchema),
  async c => {
    const { badgeKey } = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const updated = await db
        .update(badgeDefinitions)
        .set(body)
        .where(eq(badgeDefinitions.badgeKey, badgeKey))
        .returning();

      if (updated.length === 0) {
        return c.json(errorResponse("Badge not found"), 404);
      }

      return c.json(successResponse(updated[0]));
    } catch (error) {
      console.error("Error updating badge definition:", error);
      return c.json(errorResponse("Failed to update badge definition"), 500);
    }
  }
);

/**
 * DELETE /gamification/badges/:badgeKey
 *
 * Delete a badge definition (admin only).
 * Note: This will also delete all user_badges referencing this badge.
 */
gamificationRouter.delete(
  "/badges/:badgeKey",
  adminMiddleware,
  zValidator("param", badgeKeyParamSchema),
  async c => {
    const { badgeKey } = c.req.valid("param");

    try {
      // Delete user badges first (foreign key constraint)
      await db.delete(userBadges).where(eq(userBadges.badgeKey, badgeKey));

      // Delete badge definition
      const deleted = await db
        .delete(badgeDefinitions)
        .where(eq(badgeDefinitions.badgeKey, badgeKey))
        .returning();

      if (deleted.length === 0) {
        return c.json(errorResponse("Badge not found"), 404);
      }

      return c.json(successResponse({ deleted: true }));
    } catch (error) {
      console.error("Error deleting badge definition:", error);
      return c.json(errorResponse("Failed to delete badge definition"), 500);
    }
  }
);

export default gamificationRouter;
