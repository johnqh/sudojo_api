/**
 * @fileoverview Daily puzzle routes for Sudojo API
 *
 * Provides CRUD endpoints for daily puzzles. Each daily has a unique date.
 * When no daily exists for a requested date, a fallback puzzle is generated
 * by selecting a random level 3-5 board and scrambling it.
 * Public endpoints: GET (list, today, by date, by UUID)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { db, dailies, levels, boards } from "../db";
import {
  dailyCreateSchema,
  dailyUpdateSchema,
  uuidParamSchema,
  dateParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  scrambleBoard,
} from "@sudobility/sudojo_types";

const dailiesRouter = new Hono();

/**
 * Gets a random puzzle with level 3-5, scrambles it, and returns as a fallback daily.
 * Used when no daily puzzle exists for a requested date.
 */
async function getRandomFallbackPuzzle(date: string) {
  // Get all levels 3, 4, or 5
  const eligibleLevels = await db
    .select()
    .from(levels)
    .where(and(gte(levels.level, 3), lte(levels.level, 5)));

  if (eligibleLevels.length === 0) {
    return null;
  }

  // Randomly pick one level
  const randomLevel =
    eligibleLevels[Math.floor(Math.random() * eligibleLevels.length)]!;

  // Get a random puzzle with that level
  const puzzleRows = await db
    .select()
    .from(boards)
    .where(eq(boards.level, randomLevel.level))
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (puzzleRows.length === 0) {
    // Try without level filter if no puzzles found for that level
    const anyPuzzleRows = await db
      .select()
      .from(boards)
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (anyPuzzleRows.length === 0) {
      return null;
    }

    const puzzle = anyPuzzleRows[0]!;
    const scrambled = scrambleBoard(puzzle.board, puzzle.solution);

    return {
      uuid: `fallback-${date}`,
      date,
      board_uuid: puzzle.uuid,
      level: puzzle.level,
      techniques: puzzle.techniques,
      board: scrambled.puzzle,
      solution: scrambled.solution,
      created_at: null,
      updated_at: null,
    };
  }

  const puzzle = puzzleRows[0]!;
  const scrambled = scrambleBoard(puzzle.board, puzzle.solution);

  return {
    uuid: `fallback-${date}`,
    date,
    board_uuid: puzzle.uuid,
    level: randomLevel.level,
    techniques: puzzle.techniques,
    board: scrambled.puzzle,
    solution: scrambled.solution,
    created_at: null,
    updated_at: null,
  };
}

/**
 * GET /api/v1/dailies
 *
 * List all daily puzzles, ordered by date descending.
 *
 * @public No authentication required
 * @returns 200 - Array of daily puzzle objects
 */
dailiesRouter.get("/", async c => {
  const rows = await db.select().from(dailies).orderBy(desc(dailies.date));
  return c.json(successResponse(rows));
});

/**
 * GET /api/v1/dailies/today
 *
 * Get today's daily puzzle. Falls back to a random scrambled
 * puzzle with level 3-5 if no daily has been created for today.
 *
 * @public No authentication required
 * @returns 200 - Daily puzzle object (or fallback puzzle)
 * @returns 404 - No puzzles available in database
 */
dailiesRouter.get("/today", async c => {
  const today = new Date().toISOString().split("T")[0] as string;
  const rows = await db.select().from(dailies).where(eq(dailies.date, today));

  if (rows.length === 0) {
    // Fallback: get a random puzzle with level 3-5 and scramble it
    const fallback = await getRandomFallbackPuzzle(today);
    if (!fallback) {
      return c.json(errorResponse("No puzzles available"), 404);
    }
    return c.json(successResponse(fallback));
  }

  return c.json(successResponse(rows[0]));
});

/**
 * GET /api/v1/dailies/date/:date
 *
 * Get the daily puzzle for a specific date. Falls back to a random
 * scrambled puzzle with level 3-5 if no daily exists for that date.
 *
 * @public No authentication required
 * @param date - Date in YYYY-MM-DD format
 * @returns 200 - Daily puzzle object (or fallback puzzle)
 * @returns 404 - No puzzles available in database
 */
dailiesRouter.get(
  "/date/:date",
  zValidator("param", dateParamSchema),
  async c => {
    const { date } = c.req.valid("param");
    const rows = await db.select().from(dailies).where(eq(dailies.date, date));

    if (rows.length === 0) {
      // Fallback: get a random puzzle with level 3-5 and scramble it
      const fallback = await getRandomFallbackPuzzle(date);
      if (!fallback) {
        return c.json(errorResponse("No puzzles available"), 404);
      }
      return c.json(successResponse(fallback));
    }

    return c.json(successResponse(rows[0]));
  }
);

/**
 * GET /api/v1/dailies/:uuid
 *
 * Get a single daily puzzle by UUID.
 *
 * @public No authentication required
 * @param uuid - Valid UUID string
 * @returns 200 - Daily puzzle object
 * @returns 404 - Daily not found
 */
dailiesRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db.select().from(dailies).where(eq(dailies.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Daily not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

/**
 * POST /api/v1/dailies
 *
 * Create a new daily puzzle for a specific date. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body dailyCreateSchema - { date, board, solution, board_uuid?, level?, techniques? }
 * @returns 201 - Created daily puzzle object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
dailiesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", dailyCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(dailies)
      .values({
        date: body.date,
        board_uuid: body.board_uuid ?? null,
        level: body.level ?? null,
        techniques: body.techniques,
        board: body.board,
        solution: body.solution,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

/**
 * PUT /api/v1/dailies/:uuid
 *
 * Update an existing daily puzzle. Requires admin authentication.
 * Only provided fields are updated; omitted fields retain their current values.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @body dailyUpdateSchema - { date?, board?, solution?, board_uuid?, level?, techniques? }
 * @returns 200 - Updated daily puzzle object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Daily not found
 */
dailiesRouter.put(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", dailyUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(dailies)
      .where(eq(dailies.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Daily not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(dailies)
      .set({
        date: body.date ?? current.date,
        board_uuid:
          body.board_uuid !== undefined ? body.board_uuid : current.board_uuid,
        level:
          body.level !== undefined ? body.level : current.level,
        techniques: body.techniques ?? current.techniques,
        board: body.board ?? current.board,
        solution: body.solution ?? current.solution,
        updated_at: new Date(),
      })
      .where(eq(dailies.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

/**
 * DELETE /api/v1/dailies/:uuid
 *
 * Delete a daily puzzle. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @returns 200 - Deleted daily puzzle object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Daily not found
 */
dailiesRouter.delete(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(dailies)
      .where(eq(dailies.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Daily not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default dailiesRouter;
