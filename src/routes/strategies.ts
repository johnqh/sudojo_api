/**
 * @fileoverview Strategy routes for Sudojo API
 *
 * Provides CRUD endpoints for solving strategy groups (1-17).
 * Each strategy groups related techniques by shared algorithmic logic.
 * Public endpoints: GET (list sorted by difficulty, get by ID or stub)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { db, strategies } from "../db";
import {
  strategyCreateSchema,
  strategyUpdateSchema,
  strategyParamSchema,
  strategyStubParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  type Strategy,
} from "@sudobility/sudojo_types";

const strategiesRouter = new Hono();

/**
 * GET /api/v1/strategies
 *
 * List all strategies sorted by difficulty.
 *
 * @public No authentication required
 * @returns 200 - Array of strategy objects ordered by difficulty
 */
strategiesRouter.get("/", async c => {
  const rows = await db
    .select()
    .from(strategies)
    .orderBy(asc(strategies.difficulty));

  return c.json(successResponse(rows as Strategy[]));
});

/**
 * GET /api/v1/strategies/stub/:stub
 *
 * Get a single strategy by its URL-friendly stub.
 *
 * @public No authentication required
 * @param stub - URL slug (e.g., "naked-subsets", "forcing")
 * @returns 200 - Strategy object
 * @returns 404 - Strategy not found
 */
strategiesRouter.get(
  "/stub/:stub",
  zValidator("param", strategyStubParamSchema),
  async c => {
    const { stub } = c.req.valid("param");
    const rows = await db
      .select()
      .from(strategies)
      .where(eq(strategies.stub, stub));

    if (rows.length === 0) {
      return c.json(errorResponse("Strategy not found"), 404);
    }

    return c.json(successResponse(rows[0] as Strategy));
  }
);

/**
 * GET /api/v1/strategies/:strategy
 *
 * Get a single strategy by its ID.
 *
 * @public No authentication required
 * @param strategy - Integer (auto-increment ID)
 * @returns 200 - Strategy object
 * @returns 404 - Strategy not found
 */
strategiesRouter.get(
  "/:strategy",
  zValidator("param", strategyParamSchema),
  async c => {
    const { strategy } = c.req.valid("param");
    const rows = await db
      .select()
      .from(strategies)
      .where(eq(strategies.strategy, strategy));

    if (rows.length === 0) {
      return c.json(errorResponse("Strategy not found"), 404);
    }

    return c.json(successResponse(rows[0] as Strategy));
  }
);

/**
 * POST /api/v1/strategies
 *
 * Create a new strategy. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body strategyCreateSchema - { difficulty, stub }
 * @returns 201 - Created strategy object
 */
strategiesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", strategyCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(strategies)
      .values({
        difficulty: body.difficulty,
        stub: body.stub,
      })
      .returning();

    return c.json(successResponse(rows[0] as Strategy), 201);
  }
);

/**
 * PUT /api/v1/strategies/:strategy
 *
 * Update an existing strategy. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param strategy - Integer ID
 * @body strategyUpdateSchema - { difficulty?, stub? }
 * @returns 200 - Updated strategy object
 * @returns 404 - Strategy not found
 */
strategiesRouter.put(
  "/:strategy",
  adminMiddleware,
  zValidator("param", strategyParamSchema),
  zValidator("json", strategyUpdateSchema),
  async c => {
    const { strategy } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(strategies)
      .where(eq(strategies.strategy, strategy));
    if (existing.length === 0) {
      return c.json(errorResponse("Strategy not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(strategies)
      .set({
        difficulty: body.difficulty ?? current.difficulty,
        stub: body.stub ?? current.stub,
        updated_at: new Date(),
      })
      .where(eq(strategies.strategy, strategy))
      .returning();

    return c.json(successResponse(rows[0] as Strategy));
  }
);

/**
 * DELETE /api/v1/strategies/:strategy
 *
 * Delete a strategy. Requires admin authentication.
 * Sets strategy_id to NULL on associated techniques (ON DELETE SET NULL).
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param strategy - Integer ID
 * @returns 200 - Deleted strategy object
 * @returns 404 - Strategy not found
 */
strategiesRouter.delete(
  "/:strategy",
  adminMiddleware,
  zValidator("param", strategyParamSchema),
  async c => {
    const { strategy } = c.req.valid("param");

    const rows = await db
      .delete(strategies)
      .where(eq(strategies.strategy, strategy))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Strategy not found"), 404);
    }

    return c.json(successResponse(rows[0] as Strategy));
  }
);

export default strategiesRouter;
