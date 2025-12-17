import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, sql } from "drizzle-orm";
import { db, boards } from "../db";
import {
  boardCreateSchema,
  boardUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { authMiddleware } from "../middleware/auth";
import { createAccessControlMiddleware } from "../middleware/accessControl";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const boardsRouter = new Hono();
const accessControl = createAccessControlMiddleware("boards");

// GET all boards (requires auth + access control)
boardsRouter.get("/", accessControl, async c => {
  const levelUuid = c.req.query("level_uuid");

  let rows;
  if (levelUuid) {
    rows = await db
      .select()
      .from(boards)
      .where(eq(boards.level_uuid, levelUuid))
      .orderBy(desc(boards.created_at));
  } else {
    rows = await db
      .select()
      .from(boards)
      .orderBy(boards.level_uuid, desc(boards.created_at));
  }

  return c.json(successResponse(rows));
});

// GET random board (requires auth + access control)
boardsRouter.get("/random", accessControl, async c => {
  const levelUuid = c.req.query("level_uuid");

  let rows;
  if (levelUuid) {
    rows = await db
      .select()
      .from(boards)
      .where(eq(boards.level_uuid, levelUuid))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(boards)
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  if (rows.length === 0) {
    return c.json(errorResponse("No boards found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// GET one board by uuid (requires auth + access control)
boardsRouter.get(
  "/:uuid",
  accessControl,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const rows = await db.select().from(boards).where(eq(boards.uuid, uuid));

    if (rows.length === 0) {
      return c.json(errorResponse("Board not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// POST create board (requires auth + access control + admin)
boardsRouter.post(
  "/",
  accessControl,
  authMiddleware,
  zValidator("json", boardCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(boards)
      .values({
        level_uuid: body.level_uuid ?? null,
        symmetrical: body.symmetrical,
        board: body.board,
        solution: body.solution,
        techniques: body.techniques,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update board (requires auth + access control + admin)
boardsRouter.put(
  "/:uuid",
  accessControl,
  authMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", boardUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(boards)
      .where(eq(boards.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Board not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(boards)
      .set({
        level_uuid:
          body.level_uuid !== undefined ? body.level_uuid : current.level_uuid,
        symmetrical: body.symmetrical ?? current.symmetrical,
        board: body.board ?? current.board,
        solution: body.solution ?? current.solution,
        techniques: body.techniques ?? current.techniques,
        updated_at: new Date(),
      })
      .where(eq(boards.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

// DELETE board (requires auth + access control + admin)
boardsRouter.delete(
  "/:uuid",
  accessControl,
  authMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(boards)
      .where(eq(boards.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Board not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default boardsRouter;
