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

// GET all challenges (public)
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

// GET random challenge (public)
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

// GET one challenge by uuid (public)
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

// POST create challenge (admin only)
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

// PUT update challenge (admin only)
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

// DELETE challenge (admin only)
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
