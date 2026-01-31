import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { getRequiredEnv } from "../lib/env-helper";
import {
  successResponse,
  errorResponse,
  addTechnique,
  isBoardFilled,
  getMergedBoardState,
  hasInvalidPencilmarksStep,
  hasPencilmarkContent,
  EMPTY_BOARD,
  EMPTY_PENCILMARKS,
  type SolveData,
  type ValidateData,
  type GenerateData,
  type HintAccessDeniedResponse,
  type TechniqueId,
} from "@sudobility/sudojo_types";
import { db } from "../db";
import { gameSessions, pointTransactions, userStats } from "../db/schema";

// Maximum iterations for iterative solving (prevents infinite loops)
const MAX_SOLVE_ITERATIONS = 200;
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

async function proxySolverRequest<T>(
  endpoint: string,
  queryString: string
): Promise<SolverResponse<T>> {
  const url = `${SOLVER_URL}/api/${endpoint}${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[proxySolverRequest] Solver returned ${response.status} for ${endpoint}`);
      throw new Error(`Solver service error: ${response.status}`);
    }

    return response.json() as Promise<SolverResponse<T>>;
  } catch (err) {
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

// Validate a puzzle by iteratively solving it (matches frontend TechniqueExtractor)
async function validateByIterativeSolve(
  original: string,
  autoPencilmarks: boolean
): Promise<ValidateData | { error: string }> {
  // Start with empty user input (all zeros) to match how frontend TechniqueExtractor works
  let userInput = "0".repeat(81);
  let pencilmarks = "";
  let currentAutoPencilmarks = autoPencilmarks;
  let techniquesBitfield = 0;
  let maxLevel = 0;
  let iterations = 0;

  console.log(`[validate] Starting iterative solve for puzzle: ${original.substring(0, 20)}...`);

  while (iterations < MAX_SOLVE_ITERATIONS) {
    if (isBoardFilled(original, userInput)) break;

    iterations++;

    // Check if we have actual pencilmarks (not just empty commas)
    const hasPencilmarks = pencilmarks && hasPencilmarkContent(pencilmarks);

    try {
      const response = await callSolver(
        original,
        userInput,
        hasPencilmarks
          ? String(currentAutoPencilmarks)
          : String(autoPencilmarks),
        hasPencilmarks ? pencilmarks : EMPTY_PENCILMARKS
      );

      if (!response.success || !response.data?.hints?.steps?.length) {
        console.error(`[validate] Iteration ${iterations}: Solver failed to find next step`);
        return { error: "Solver failed to find next step" };
      }

      if (hasInvalidPencilmarksStep(response.data.hints.steps)) {
        console.error(`[validate] Iteration ${iterations}: Invalid pencilmarks detected`);
        return { error: "Invalid pencilmarks detected" };
      }

      const hints = response.data.hints;
      if (hints.technique > 0) {
        techniquesBitfield = addTechnique(
          techniquesBitfield,
          hints.technique as TechniqueId
        );
      }
      if (hints.level > 0) {
        maxLevel = Math.max(maxLevel, hints.level);
      }

      const boardData = response.data.board;
      if (boardData?.user) {
        userInput = boardData.user;
        pencilmarks = boardData.pencilmark?.numbers ?? "";
        currentAutoPencilmarks =
          boardData.pencilmark?.autopencil ?? autoPencilmarks;
        if (isBoardFilled(original, userInput)) break;
      } else {
        console.error(`[validate] Iteration ${iterations}: Solver did not return board state`);
        return { error: "Solver did not return board state" };
      }
    } catch (err) {
      console.error(`[validate] Iteration ${iterations}: Error calling solver:`, err);
      return { error: `Solver error at iteration ${iterations}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (!isBoardFilled(original, userInput)) {
    console.error(`[validate] Failed to solve puzzle within ${iterations} iterations`);
    return { error: "Failed to solve puzzle within iteration limit" };
  }

  console.log(`[validate] Completed in ${iterations} iterations, level=${maxLevel}, techniques=0x${techniquesBitfield.toString(16)}`);

  const solution = getMergedBoardState(original, userInput);

  return {
    board: {
      level: maxLevel,
      techniques: techniquesBitfield,
      original,
      solution,
    },
  };
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

      // If technique-filtered solve fails, fallback to generic solve
      if (!result.success || !result.data) {
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

// GET /solve - Get hints for solving a puzzle
// Access controlled by subscription tier:
//   - red_belt or site admin: all levels
//   - blue_belt: levels 1-5
//   - free/anonymous: levels 1-3
// Query params:
//   - original: 81 digits (required)
//   - user: 81 digits, 0=empty (optional, defaults to 81 zeros)
//   - autopencilmarks: true/false (optional, defaults to false)
//   - pencilmarks: comma-separated 81 elements (optional, defaults to empty)
//   - techniques: comma-delimited list of technique numbers to filter (optional, e.g., "1,2,3")
solverRouter.get("/solve", hintAccessMiddleware, handleSolveRequest);

// GET /validate - Validate a puzzle by iteratively solving it
// Matches frontend TechniqueExtractor behavior - iteratively calls /solve
// to accumulate techniques and level, rather than calling solver /validate directly.
// Query params:
//   - original: 81-char puzzle string (required)
//   - autopencilmarks: true/false (optional, defaults to false)
solverRouter.get("/validate", async c => {
  try {
    const original = c.req.query("original") ?? "";
    const autoPencilmarks = c.req.query("autopencilmarks") === "true";

    if (!original || original.length !== 81) {
      return c.json(errorResponse("Invalid puzzle: original must be 81 characters"), 400);
    }

    const result = await validateByIterativeSolve(original, autoPencilmarks);

    if ("error" in result) {
      return c.json(errorResponse(result.error), 400);
    }

    return c.json(successResponse(result));
  } catch (error) {
    console.error("Validate error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
});

// GET /generate - Generate a random puzzle (public)
// Query params: symmetrical
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
