/**
 * @fileoverview Play routes for game session management and gamification
 *
 * Handles:
 * - Game session start/finish
 * - Points calculation and awarding
 * - Badge checking and awarding
 * - User level promotion
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, inArray } from "drizzle-orm";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import { gameStartSchema, gameFinishSchema } from "../schemas";
import { db } from "../db";
import {
  gameSessions,
  userStats,
  userBadges,
  badgeDefinitions,
  pointTransactions,
} from "../db/schema";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const playRouter = new Hono();

// =============================================================================
// Constants
// =============================================================================

/** Tolerance in seconds for interruption detection (network latency) */
const INTERRUPTION_TOLERANCE_SECONDS = 1;

/** Multiplier for completing without hints */
const NO_HINT_MULTIPLIER = 10;

/** Multiplier for completing without interruption */
const NO_INTERRUPTION_MULTIPLIER = 2;

/** Games-played badge milestones */
const GAMES_MILESTONES = [5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate base points for a puzzle level using exponential scaling: 2^level
 */
function calculateBasePoints(level: number): number {
  return Math.pow(2, level);
}

/**
 * Detect if the game was interrupted by comparing elapsed time with server time
 * @param startedAt - When the game session started
 * @param elapsedTime - Elapsed time reported by frontend (seconds)
 * @returns true if interrupted (paused), false if continuous play
 */
function wasGameInterrupted(startedAt: Date, elapsedTime: number): boolean {
  const now = new Date();
  const serverElapsed = (now.getTime() - startedAt.getTime()) / 1000;
  // If frontend elapsed time is significantly less than server elapsed time,
  // the user must have paused the game
  return elapsedTime < serverElapsed - INTERRUPTION_TOLERANCE_SECONDS;
}

/**
 * Get or create user stats record
 */
async function getOrCreateUserStats(userId: string) {
  const existing = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new user stats
  const newStats = await db
    .insert(userStats)
    .values({ userId })
    .returning();

  return newStats[0];
}

/**
 * Check and award badges based on current game completion
 * @returns Array of newly earned badges
 */
async function checkAndAwardBadges(
  userId: string,
  puzzleLevel: number,
  isPerfectPlay: boolean,
  newGamesCompleted: number
): Promise<Array<{ badgeKey: string; title: string; description: string | null }>> {
  const newBadges: Array<{ badgeKey: string; title: string; description: string | null }> = [];

  // Get user's existing badges
  const existingBadges = await db
    .select({ badgeKey: userBadges.badgeKey })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const existingBadgeKeys = new Set(existingBadges.map(b => b.badgeKey));

  // Check for level mastery badge (perfect play only)
  if (isPerfectPlay) {
    const levelBadgeKey = `level_${puzzleLevel}`;
    if (!existingBadgeKeys.has(levelBadgeKey)) {
      // Check if badge definition exists
      const badgeDef = await db
        .select()
        .from(badgeDefinitions)
        .where(eq(badgeDefinitions.badgeKey, levelBadgeKey));

      if (badgeDef.length > 0) {
        await db.insert(userBadges).values({
          userId,
          badgeKey: levelBadgeKey,
        });
        newBadges.push({
          badgeKey: levelBadgeKey,
          title: badgeDef[0].title,
          description: badgeDef[0].description,
        });
        existingBadgeKeys.add(levelBadgeKey);
      }
    }
  }

  // Check for games-played milestones
  for (const milestone of GAMES_MILESTONES) {
    if (newGamesCompleted >= milestone) {
      const gamesBadgeKey = `games_${milestone}`;
      if (!existingBadgeKeys.has(gamesBadgeKey)) {
        // Check if badge definition exists
        const badgeDef = await db
          .select()
          .from(badgeDefinitions)
          .where(eq(badgeDefinitions.badgeKey, gamesBadgeKey));

        if (badgeDef.length > 0) {
          await db.insert(userBadges).values({
            userId,
            badgeKey: gamesBadgeKey,
          });
          newBadges.push({
            badgeKey: gamesBadgeKey,
            title: badgeDef[0].title,
            description: badgeDef[0].description,
          });
          existingBadgeKeys.add(gamesBadgeKey);
        }
      }
    }
  }

  return newBadges;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /play/start
 *
 * Start a new game session. Closes any existing session for the user.
 * Returns session ID and start timestamp.
 */
playRouter.post(
  "/start",
  firebaseAuthMiddleware,
  zValidator("json", gameStartSchema),
  async c => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    try {
      // Delete any existing session for this user (abandoning previous game)
      await db.delete(gameSessions).where(eq(gameSessions.userId, userId));

      // Create new session
      const newSession = await db
        .insert(gameSessions)
        .values({
          userId,
          board: body.board,
          solution: body.solution,
          level: body.level,
          techniques: body.techniques,
          puzzleType: body.puzzleType,
          puzzleId: body.puzzleId,
          hintUsed: false,
          hintsCount: 0,
          hintPointsEarned: 0,
        })
        .returning();

      return c.json(
        successResponse({
          sessionId: newSession[0].id,
          startedAt: newSession[0].startedAt?.toISOString(),
        }),
        201
      );
    } catch (error) {
      console.error("Error starting game session:", error);
      return c.json(errorResponse("Failed to start game session"), 500);
    }
  }
);

/**
 * POST /play/finish
 *
 * Complete the current game and award points/badges/level.
 * Requires an active game session.
 */
playRouter.post(
  "/finish",
  firebaseAuthMiddleware,
  zValidator("json", gameFinishSchema),
  async c => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    try {
      // Get active session
      const sessions = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.userId, userId));

      if (sessions.length === 0) {
        return c.json(
          errorResponse("No active game session. Call /play/start first."),
          400
        );
      }

      const session = sessions[0];

      // Calculate interruption status
      const interrupted = wasGameInterrupted(
        session.startedAt,
        body.elapsedTime
      );

      // Calculate points (hint points are awarded separately via /solver/solve)
      const basePoints = calculateBasePoints(session.level);
      const noHintMultiplier = session.hintUsed ? 1 : NO_HINT_MULTIPLIER;
      const noInterruptionMultiplier = interrupted ? 1 : NO_INTERRUPTION_MULTIPLIER;
      const totalPoints = basePoints * noHintMultiplier * noInterruptionMultiplier;

      // Determine if this is "perfect play" (no hints AND no interruption)
      const isPerfectPlay = !session.hintUsed && !interrupted;

      // Get or create user stats
      const stats = await getOrCreateUserStats(userId);

      // Calculate new values (only add puzzle points, hint points already added)
      const newTotalPoints = stats.totalPoints + totalPoints;
      const newGamesCompleted = stats.gamesCompleted + 1;

      // Check for level promotion (perfect play on higher level puzzle)
      let newUserLevel = stats.userLevel;
      let leveledUp = false;
      if (isPerfectPlay && session.level > stats.userLevel) {
        newUserLevel = session.level;
        leveledUp = true;
      }

      // Update user stats
      await db
        .update(userStats)
        .set({
          totalPoints: newTotalPoints,
          gamesCompleted: newGamesCompleted,
          userLevel: newUserLevel,
          updatedAt: new Date(),
        })
        .where(eq(userStats.userId, userId));

      // Check and award badges
      const newBadges = await checkAndAwardBadges(
        userId,
        session.level,
        isPerfectPlay,
        newGamesCompleted
      );

      // Record point transaction for puzzle completion
      await db.insert(pointTransactions).values({
        userId,
        points: totalPoints,
        transactionType: "puzzle_complete",
        metadata: {
          puzzleLevel: session.level,
          puzzleType: session.puzzleType,
          puzzleId: session.puzzleId,
          basePoints,
          hintUsed: session.hintUsed,
          hintsCount: session.hintsCount,
          interrupted,
          noHintMultiplier,
          noInterruptionMultiplier,
          elapsedTime: body.elapsedTime,
        },
      });

      // Delete the completed session
      await db.delete(gameSessions).where(eq(gameSessions.userId, userId));

      // Build response with optional fields
      const response: {
        points: {
          basePoints: number;
          noHintMultiplier: number;
          noInterruptionMultiplier: number;
          totalPoints: number;
        };
        level?: { newUserLevel: number };
        badges?: Array<{ badgeKey: string; title: string; description: string | null }>;
      } = {
        points: {
          basePoints,
          noHintMultiplier,
          noInterruptionMultiplier,
          totalPoints,
        },
      };

      // Only include level if user leveled up
      if (leveledUp) {
        response.level = { newUserLevel };
      }

      // Only include badges if new badges were earned
      if (newBadges.length > 0) {
        response.badges = newBadges;
      }

      return c.json(successResponse(response));
    } catch (error) {
      console.error("Error finishing game:", error);
      return c.json(errorResponse("Failed to finish game"), 500);
    }
  }
);

export default playRouter;
