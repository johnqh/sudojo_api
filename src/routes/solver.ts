import { Hono, type Context } from "hono";
import { getRequiredEnv } from "../lib/env-helper";
import {
  successResponse,
  errorResponse,
  type SolveData,
  type ValidateData,
  type GenerateData,
  type HintAccessDeniedResponse,
} from "@sudobility/sudojo_types";
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
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Solver service error: ${response.status}`);
  }

  return response.json() as Promise<SolverResponse<T>>;
}

// Default values for optional solve parameters
const DEFAULT_USER = "0".repeat(81); // 81 zeros - user hasn't entered anything
const DEFAULT_PENCILMARKS = ",".repeat(80); // 81 empty elements (80 commas)
const DEFAULT_AUTOPENCILMARKS = "false";

// Helper to handle solve request with hint access control
async function handleSolveRequest(c: Context) {
  try {
    // Get query params with defaults
    const original = c.req.query("original") ?? "";
    const user = c.req.query("user") ?? DEFAULT_USER;
    const autopencilmarks = c.req.query("autopencilmarks") ?? DEFAULT_AUTOPENCILMARKS;
    const pencilmarks = c.req.query("pencilmarks") ?? DEFAULT_PENCILMARKS;
    const technique = c.req.query("technique");

    // Build query string with defaults applied
    const params = new URLSearchParams();
    params.set("original", original);
    params.set("user", user);
    params.set("autopencilmarks", autopencilmarks);
    params.set("pencilmarks", pencilmarks);
    if (technique) {
      params.set("technique", technique);
    }

    const result = await proxySolverRequest<SolveData>("solve", params.toString());

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

    return c.json(successResponse(result.data));
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
//   - technique: technique number to filter (optional)
solverRouter.get("/solve", hintAccessMiddleware, handleSolveRequest);

// GET /validate - Validate a puzzle has a unique solution (public)
// Query params: original
solverRouter.get("/validate", async c => {
  try {
    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<ValidateData>(
      "validate",
      queryString
    );

    if (!result.success || !result.data) {
      const errorMsg = result.error
        ? `${result.error.code}: ${result.error.message}`
        : "Invalid puzzle";
      return c.json(errorResponse(errorMsg), 400);
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Solver proxy error:", error);
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
