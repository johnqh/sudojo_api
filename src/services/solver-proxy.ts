/**
 * @fileoverview Solver proxy service
 *
 * Shared helper for calling the external solver service.
 * Used by solver routes and practice routes.
 */

import { getRequiredEnv, getEnv } from "../lib/env-helper";
import type { SolveData } from "@sudobility/sudojo_types";

const SOLVER_URL = getRequiredEnv("SOLVER_URL");

// Timeout for solver requests. Defaults to 60 seconds and can be overridden
// with SOLVER_TIMEOUT_MS for environments that need a longer budget.
const SOLVER_TIMEOUT_MS = parseInt(getEnv("SOLVER_TIMEOUT_MS", "60000")!, 10);

export interface SolverResponse<T> {
  success: boolean;
  error: { code: string; message: string } | null;
  data: T | null;
}

export async function proxySolverRequest<T>(
  endpoint: string,
  queryString: string
): Promise<SolverResponse<T>> {
  const url = `${SOLVER_URL}/api/${endpoint}${queryString ? `?${queryString}` : ""}`;
  console.log(`[proxySolverRequest] ${url}`);
  const startedAt = Date.now();

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[proxySolverRequest] Solver returned ${response.status} for ${endpoint}`
      );
      throw new Error(`Solver service error: ${response.status}`);
    }

    return response.json() as Promise<SolverResponse<T>>;
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === "AbortError") {
      console.error(
        `[proxySolverRequest] Solver request timed out after ${elapsedMs}ms (configured ${SOLVER_TIMEOUT_MS}ms) for ${endpoint}`
      );
      throw new Error(
        `Solver service timeout after ${Math.round(elapsedMs / 1000)}s`
      );
    }
    console.error(`[proxySolverRequest] Failed to fetch ${endpoint}:`, err);
    throw err;
  }
}

/** Call the solver with given params */
export async function callSolver(
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
