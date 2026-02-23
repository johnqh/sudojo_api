/**
 * @fileoverview Solver proxy routes for Sudojo API
 *
 * Proxies requests to the external solver service for puzzle solving,
 * validation, and generation. Implements hint access control based on
 * subscription tier and tracks hint usage for gamification.
 *
 * Access tiers for /solve:
 * - red_belt or site admin: all hint levels
 * - blue_belt: hint levels 1-5
 * - free/anonymous: hint levels 1-3
 *
 * Public endpoints: GET /validate, GET /generate
 * Access-controlled: GET /solve (hint access middleware, no hard auth required)
 */

import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { getRequiredEnv } from "../lib/env-helper";
import {
  successResponse,
  errorResponse,
  EMPTY_BOARD,
  EMPTY_PENCILMARKS,
  type SolveData,
  type ValidateData,
  type GenerateData,
  type HintAccessDeniedResponse,
} from "@sudobility/sudojo_types";
import { db } from "../db";
import { gameSessions, pointTransactions, userStats } from "../db/schema";

import {
  hintAccessMiddleware,
  getRequiredEntitlement,
  type HintAccessContext,
} from "../middleware/hintAccess";

const solverRouter = new Hono();

const SOLVER_URL = getRequiredEnv("SOLVER_URL");

interface SolverResponse<T> {
  success: boolean;
  error: { code: string; message: string } | null;
  data: T | null;
}

// Timeout for solver requests (120 seconds)
const SOLVER_TIMEOUT_MS = 120000;

async function proxySolverRequest<T>(
  endpoint: string,
  queryString: string
): Promise<SolverResponse<T>> {
  const url = `${SOLVER_URL}/api/${endpoint}${queryString ? `?${queryString}` : ""}`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[proxySolverRequest] Solver returned ${response.status} for ${endpoint}`);
      throw new Error(`Solver service error: ${response.status}`);
    }

    return response.json() as Promise<SolverResponse<T>>;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[proxySolverRequest] Solver request timed out after ${SOLVER_TIMEOUT_MS}ms for ${endpoint}`);
      throw new Error(`Solver service timeout after ${SOLVER_TIMEOUT_MS / 1000}s`);
    }
    console.error(`[proxySolverRequest] Failed to fetch ${endpoint}:`, err);
    throw err;
  }
}

// Default autopencilmarks setting
const DEFAULT_AUTOPENCILMARKS = "false";

// Helper to call solver with given params
async function callSolver(
  original: string,
  user: string,
  autopencilmarks: string,
  pencilmarks: string,
  techniques?: string
): Promise<SolverResponse<SolveData>> {
  const params = new URLSearchParams();
  params.set("original", original);
  params.set("user", user);
  params.set("autopencilmarks", autopencilmarks);
  params.set("pencilmarks", pencilmarks);
  if (techniques) {
    params.set("techniques", techniques);
  }
  return proxySolverRequest<SolveData>("solve", params.toString());
}

/**
 * Track hint usage for gamification when user has an active session.
 * Awards hint points immediately: 2 × technique_level
 * Points are added to user's total and recorded as a transaction.
 */
async function trackHintUsage(
  userId: string,
  originalBoard: string,
  techniqueLevel: number
): Promise<{ tracked: boolean; hintPoints: number }> {
  try {
    // Check if user has an active session with matching board
    const sessions = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.userId, userId));

    if (sessions.length === 0) {
      return { tracked: false, hintPoints: 0 };
    }

    const session = sessions[0];

    // Board must match the active session
    if (session.board !== originalBoard) {
      return { tracked: false, hintPoints: 0 };
    }

    // Calculate hint points: 2 × technique_level
    const hintPoints = 2 * techniqueLevel;

    // Update session: mark hint used, increment count
    await db
      .update(gameSessions)
      .set({
        hintUsed: true,
        hintsCount: session.hintsCount + 1,
      })
      .where(eq(gameSessions.userId, userId));

    // Get current user stats
    const existingStats = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userId, userId));

    if (existingStats.length > 0) {
      // Update user's total points immediately
      await db
        .update(userStats)
        .set({
          totalPoints: existingStats[0].totalPoints + hintPoints,
          updatedAt: new Date(),
        })
        .where(eq(userStats.userId, userId));
    } else {
      // Create user stats if they don't exist
      await db.insert(userStats).values({
        userId,
        totalPoints: hintPoints,
      });
    }

    // Record point transaction for the hint
    await db.insert(pointTransactions).values({
      userId,
      points: hintPoints,
      transactionType: "hint_used",
      metadata: {
        techniqueLevel,
        puzzleLevel: session.level,
        puzzleType: session.puzzleType,
        puzzleId: session.puzzleId,
      },
    });

    return { tracked: true, hintPoints };
  } catch (error) {
    console.error("Error tracking hint usage:", error);
    return { tracked: false, hintPoints: 0 };
  }
}

// Helper to handle solve request with hint access control
async function handleSolveRequest(c: Context) {
  try {
    // Get query params with defaults
    const original = c.req.query("original") ?? "";
    const user = c.req.query("user") ?? EMPTY_BOARD;
    const autopencilmarks = c.req.query("autopencilmarks") ?? DEFAULT_AUTOPENCILMARKS;
    const pencilmarks = c.req.query("pencilmarks") ?? EMPTY_PENCILMARKS;
    const techniques = c.req.query("techniques");

    let result: SolverResponse<SolveData>;

    if (techniques) {
      // If technique is specified, try with technique first
      result = await callSolver(original, user, autopencilmarks, pencilmarks, techniques);

      // If technique-filtered solve fails, or solve contains an auto pencilmark hint, fallback to generic solve
      if (!result.success || !result.data || result.data.hints?.level === 0) {
        result = await callSolver(original, user, autopencilmarks, pencilmarks);
      }
    } else {
      // No technique specified, just call generic solve
      result = await callSolver(original, user, autopencilmarks, pencilmarks);
    }

    if (!result.success || !result.data) {
      const errorMsg = result.error
        ? `${result.error.code}: ${result.error.message}`
        : "Solver error";
      return c.json(errorResponse(errorMsg), 400);
    }

    // Check hint access based on hint level
    const hintAccess = c.get("hintAccess") as HintAccessContext | undefined;
    const hintLevel = result.data.hints?.level ?? 0;

    if (hintAccess && hintLevel > hintAccess.maxHintLevel) {
      // User doesn't have access to this hint level
      const response: HintAccessDeniedResponse = {
        success: false,
        error: {
          code: "HINT_ACCESS_DENIED",
          message: `This hint requires a higher subscription tier. Hint level: ${hintLevel}, your max level: ${hintAccess.maxHintLevel}`,
          hintLevel,
          requiredEntitlement: getRequiredEntitlement(hintLevel),
          userState: hintAccess.userState,
        },
        timestamp: new Date().toISOString(),
      };
      return c.json(response, 402);
    }

    // Track hint usage for gamification (if user is authenticated)
    const firebaseUser = c.get("firebaseUser") as { uid: string } | undefined;
    const techniqueLevel = result.data.hints?.level ?? 1;
    let pointsEarned: { points: number; techniqueLevel: number } | undefined;

    if (firebaseUser?.uid) {
      const { tracked, hintPoints } = await trackHintUsage(
        firebaseUser.uid,
        original,
        techniqueLevel
      );
      if (tracked) {
        pointsEarned = {
          points: hintPoints,
          techniqueLevel,
        };
      }
    }

    // Add points info to response if awarded
    const responseData = pointsEarned
      ? { ...result.data, points: pointsEarned }
      : result.data;

    return c.json(successResponse(responseData));
  } catch (error) {
    console.error("Solver proxy error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
}

/**
 * GET /api/v1/solver/solve
 *
 * Get hints for solving a puzzle. Access controlled by subscription tier.
 * If an authenticated user has an active game session, hint usage is tracked
 * for gamification (awards 2 x technique_level points).
 *
 * @auth Optional - anonymous users get free tier access (levels 1-3)
 * @query original - 81-digit puzzle string (required)
 * @query user - 81-digit user input string, 0=empty (defaults to 81 zeros)
 * @query autopencilmarks - "true"/"false" (defaults to "false")
 * @query pencilmarks - Comma-separated 81 elements (defaults to empty)
 * @query techniques - Comma-delimited technique numbers to filter (e.g., "1,2,3")
 * @returns 200 - Solve data with hints
 * @returns 400 - Solver error (invalid puzzle)
 * @returns 402 - Hint access denied (requires higher subscription tier)
 * @returns 503 - Solver service unavailable
 */
solverRouter.get("/solve", hintAccessMiddleware, handleSolveRequest);

/**
 * GET /api/v1/solver/validate
 *
 * Validate a Sudoku puzzle by proxying to the solver's /validate endpoint.
 * Checks puzzle validity, uniqueness, and determines difficulty level.
 *
 * @public No authentication required
 * @query original - 81-char puzzle string (required)
 * @query brutalForce - "true"/"false" - verify uniqueness via brute force (defaults to "true")
 * @returns 200 - Validation data (level, techniques, solution)
 * @returns 400 - Invalid puzzle or validation failed
 * @returns 503 - Solver service unavailable
 */
solverRouter.get("/validate", async c => {
  try {
    const original = c.req.query("original") ?? "";

    if (!original || original.length !== 81) {
      return c.json(errorResponse("Invalid puzzle: original must be 81 characters"), 400);
    }

    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<ValidateData>("validate", queryString);

    if (!result.success || !result.data) {
      const errorMsg = result.error
        ? `${result.error.code}: ${result.error.message}`
        : "Validation failed";
      return c.json(errorResponse(errorMsg), 400);
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Validate error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
});

/**
 * GET /api/v1/solver/generate
 *
 * Generate a random Sudoku puzzle by proxying to the solver's /generate endpoint.
 *
 * @public No authentication required
 * @query symmetrical - "true"/"false" - generate symmetrical puzzle
 * @returns 200 - Generated puzzle data (board, solution, level, techniques)
 * @returns 500 - Generation failed
 * @returns 503 - Solver service unavailable
 */
solverRouter.get("/generate", async c => {
  try {
    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<GenerateData>(
      "generate",
      queryString
    );

    if (!result.success || !result.data) {
      const errorMsg = result.error
        ? `${result.error.code}: ${result.error.message}`
        : "Generation failed";
      return c.json(errorResponse(errorMsg), 500);
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Solver proxy error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
});

export default solverRouter;
