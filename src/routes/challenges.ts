import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db, challenges } from "../db";
import {
  challengeCreateSchema,
  challengeUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { authMiddleware } from "../middleware/auth";
import { createAccessControlMiddleware } from "../middleware/accessControl";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const challengesRouter = new Hono();
const accessControl = createAccessControlMiddleware("challenges");

// GET all challenges (requires auth + access control)
challengesRouter.get("/", accessControl, async c => {
  const levelUuid = c.req.query("level_uuid");
  const difficulty = c.req.query("difficulty");

  let rows;
  if (levelUuid && difficulty) {
    rows = await db
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.level_uuid, levelUuid),
          eq(challenges.difficulty, parseInt(difficulty))
        )
      )
      .orderBy(asc(challenges.difficulty));
  } else if (levelUuid) {
    rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.level_uuid, levelUuid))
      .orderBy(asc(challenges.difficulty));
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

// GET random challenge (requires auth + access control)
challengesRouter.get("/random", accessControl, async c => {
  const levelUuid = c.req.query("level_uuid");
  const difficulty = c.req.query("difficulty");

  let rows;
  if (levelUuid && difficulty) {
    rows = await db
      .select()
      .from(challenges)
      .where(
        and(
          eq(challenges.level_uuid, levelUuid),
          eq(challenges.difficulty, parseInt(difficulty))
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(1);
  } else if (levelUuid) {
    rows = await db
      .select()
      .from(challenges)
      .where(eq(challenges.level_uuid, levelUuid))
      .orderBy(sql`RANDOM()`)
      .limit(1);
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

// GET one challenge by uuid (requires auth + access control)
challengesRouter.get(
  "/:uuid",
  accessControl,
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

// POST create challenge (requires auth + access control + admin)
challengesRouter.post(
  "/",
  accessControl,
  authMiddleware,
  zValidator("json", challengeCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(challenges)
      .values({
        board_uuid: body.board_uuid ?? null,
        level_uuid: body.level_uuid ?? null,
        difficulty: body.difficulty,
        board: body.board,
        solution: body.solution,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update challenge (requires auth + access control + admin)
challengesRouter.put(
  "/:uuid",
  accessControl,
  authMiddleware,
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
        level_uuid:
          body.level_uuid !== undefined ? body.level_uuid : current.level_uuid,
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

// DELETE challenge (requires auth + access control + admin)
challengesRouter.delete(
  "/:uuid",
  accessControl,
  authMiddleware,
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
