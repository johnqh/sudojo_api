/**
 * @fileoverview Challenge routes for Sudojo API
 *
 * Provides CRUD endpoints for challenge puzzles.
 * Challenges have a difficulty rating (1-10) and optional level association.
 * Public endpoints: GET (list with level/difficulty filters, random, get by UUID)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db, challenges } from "../db";
import {
  challengeCreateSchema,
  challengeUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const challengesRouter = new Hono();

/**
 * GET /api/v1/challenges
 *
 * List all challenges with optional filtering by level and/or difficulty.
 *
 * @public No authentication required
 * @query level - Filter by difficulty level (integer)
 * @query difficulty - Filter by difficulty rating (integer 1-10)
 * @returns 200 - Array of challenge objects ordered by difficulty asc, created_at desc
 */
challengesRouter.get("/", async c => {
  const levelParam = c.req.query("level");
  const difficulty = c.req.query("difficulty");

  let rows;
  if (levelParam && difficulty) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      rows = await db
        .select()
        .from(challenges)
        .where(
          and(
            eq(challenges.level, level),
            eq(challenges.difficulty, parseInt(difficulty))
          )
        )
        .orderBy(asc(challenges.difficulty));
    } else {
      rows = await db
        .select()
        .from(challenges)
        .orderBy(asc(challenges.difficulty), desc(challenges.created_at));
    }
  } else if (levelParam) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      rows = await db
        .select()
        .from(challenges)
        .where(eq(challenges.level, level))
        .orderBy(asc(challenges.difficulty));
    } else {
      rows = await db
        .select()
        .from(challenges)
        .orderBy(asc(challenges.difficulty), desc(challenges.created_at));
    }
  } else if (difficulty) {
    rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.difficulty, parseInt(difficulty)))
      .orderBy(desc(challenges.created_at));
  } else {
    rows = await db
      .select()
      .from(challenges)
      .orderBy(asc(challenges.difficulty), desc(challenges.created_at));
  }

  return c.json(successResponse(rows));
});

/**
 * GET /api/v1/challenges/random
 *
 * Get a random challenge with optional filtering.
 *
 * @public No authentication required
 * @query level - Filter by difficulty level (integer)
 * @query difficulty - Filter by difficulty rating (integer 1-10)
 * @returns 200 - Single challenge object
 * @returns 404 - No challenges found matching criteria
 */
challengesRouter.get("/random", async c => {
  const levelParam = c.req.query("level");
  const difficulty = c.req.query("difficulty");

  let rows;
  if (levelParam && difficulty) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      rows = await db
        .select()
        .from(challenges)
        .where(
          and(
            eq(challenges.level, level),
            eq(challenges.difficulty, parseInt(difficulty))
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(1);
    } else {
      rows = await db
        .select()
        .from(challenges)
        .orderBy(sql`RANDOM()`)
        .limit(1);
    }
  } else if (levelParam) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      rows = await db
        .select()
        .from(challenges)
        .where(eq(challenges.level, level))
        .orderBy(sql`RANDOM()`)
        .limit(1);
    } else {
      rows = await db
        .select()
        .from(challenges)
        .orderBy(sql`RANDOM()`)
        .limit(1);
    }
  } else if (difficulty) {
    rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.difficulty, parseInt(difficulty)))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(challenges)
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  if (rows.length === 0) {
    return c.json(errorResponse("No challenges found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

/**
 * GET /api/v1/challenges/:uuid
 *
 * Get a single challenge by UUID.
 *
 * @public No authentication required
 * @param uuid - Valid UUID string
 * @returns 200 - Challenge object
 * @returns 404 - Challenge not found
 */
challengesRouter.get(
  "/:uuid",
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.uuid, uuid));

    if (rows.length === 0) {
      return c.json(errorResponse("Challenge not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

/**
 * POST /api/v1/challenges
 *
 * Create a new challenge. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body challengeCreateSchema - { board, solution, board_uuid?, level?, difficulty? }
 * @returns 201 - Created challenge object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
challengesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", challengeCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(challenges)
      .values({
        board_uuid: body.board_uuid ?? null,
        level: body.level ?? null,
        difficulty: body.difficulty,
        board: body.board,
        solution: body.solution,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

/**
 * PUT /api/v1/challenges/:uuid
 *
 * Update an existing challenge. Requires admin authentication.
 * Only provided fields are updated; omitted fields retain their current values.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @body challengeUpdateSchema - { board?, solution?, board_uuid?, level?, difficulty? }
 * @returns 200 - Updated challenge object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Challenge not found
 */
challengesRouter.put(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", challengeUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(challenges)
      .where(eq(challenges.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Challenge not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(challenges)
      .set({
        board_uuid:
          body.board_uuid !== undefined ? body.board_uuid : current.board_uuid,
        level:
          body.level !== undefined ? body.level : current.level,
        difficulty: body.difficulty ?? current.difficulty,
        board: body.board ?? current.board,
        solution: body.solution ?? current.solution,
        updated_at: new Date(),
      })
      .where(eq(challenges.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

/**
 * DELETE /api/v1/challenges/:uuid
 *
 * Delete a challenge. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @returns 200 - Deleted challenge object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Challenge not found
 */
challengesRouter.delete(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(challenges)
      .where(eq(challenges.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Challenge not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default challengesRouter;
