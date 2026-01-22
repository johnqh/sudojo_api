import { Hono, type Context } from "hono";
import { getRequiredEnv } from "../lib/env-helper";
import {
  successResponse,
  errorResponse,
  type SolveData,
  type ValidateData,
  type GenerateData,
} from "@sudobility/sudojo_types";
import { createAccessControlMiddleware } from "../middleware/accessControl";

const solverRouter = new Hono();

const SOLVER_URL = getRequiredEnv("SOLVER_URL");
const SOLVER_API_KEY = process.env.SOLVER_API_KEY;
const accessControl = createAccessControlMiddleware("solve");

interface SolverResponse<T> {
  success: boolean;
  error: { code: string; message: string } | null;
  data: T | null;
}

function isValidApiKey(apiKey: string | undefined): boolean {
  return !!SOLVER_API_KEY && !!apiKey && apiKey === SOLVER_API_KEY;
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

// Helper to handle solve request
async function handleSolveRequest(c: Context) {
  try {
    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<SolveData>("solve", queryString);

    if (!result.success || !result.data) {
      const errorMsg = result.error
        ? `${result.error.code}: ${result.error.message}`
        : "Solver error";
      return c.json(errorResponse(errorMsg), 400);
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Solver proxy error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
}

// GET /solve - Get hints for solving a puzzle (rate limited: 10/day, unless apiKey provided)
// Query params: original, user, autopencilmarks, pencilmarks, filters, apiKey
solverRouter.get("/solve", async (c, next) => {
  const apiKey = c.req.query("apiKey");
  if (isValidApiKey(apiKey)) {
    return handleSolveRequest(c);
  }
  return accessControl(c, next);
}, handleSolveRequest);

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
