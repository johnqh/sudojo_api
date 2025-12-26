import { Hono } from "hono";
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
const accessControl = createAccessControlMiddleware("solve");

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

// GET /solve - Get hints for solving a puzzle (rate limited: 10/day)
// Query params: original, user, autopencilmarks, pencilmarks, filters
solverRouter.get("/solve", accessControl, async (c) => {
  try {
    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<SolveData>("solve", queryString);

    if (!result.success || !result.data) {
      return c.json(
        errorResponse(result.error?.message || "Solver error"),
        400
      );
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Solver proxy error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
});

// GET /validate - Validate a puzzle has a unique solution (public)
// Query params: original
solverRouter.get("/validate", async (c) => {
  try {
    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<ValidateData>("validate", queryString);

    if (!result.success || !result.data) {
      return c.json(
        errorResponse(result.error?.message || "Invalid puzzle"),
        400
      );
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Solver proxy error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
});

// GET /generate - Generate a random puzzle (public)
// Query params: symmetrical
solverRouter.get("/generate", async (c) => {
  try {
    const queryString = new URL(c.req.url).search.slice(1);
    const result = await proxySolverRequest<GenerateData>("generate", queryString);

    if (!result.success || !result.data) {
      return c.json(
        errorResponse(result.error?.message || "Generation failed"),
        500
      );
    }

    return c.json(successResponse(result.data));
  } catch (error) {
    console.error("Solver proxy error:", error);
    return c.json(errorResponse("Solver service unavailable"), 503);
  }
});

export default solverRouter;
