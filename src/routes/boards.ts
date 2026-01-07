import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, sql } from "drizzle-orm";
import { db, boards } from "../db";
import {
  boardCreateSchema,
  boardUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const boardsRouter = new Hono();

// GET all boards (public)
boardsRouter.get("/", async c => {
  const levelUuid = c.req.query("level_uuid");
  const techniqueBit = c.req.query("technique_bit");
  const techniques = c.req.query("techniques");
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");

  let query = db.select().from(boards).$dynamic();

  // Filter by level_uuid if provided
  if (levelUuid) {
    query = query.where(eq(boards.level_uuid, levelUuid));
  }

  // Filter by technique bit if provided (boards that have this technique)
  if (techniqueBit) {
    const bit = parseInt(techniqueBit, 10);
    if (!isNaN(bit) && bit > 0) {
      query = query.where(sql`(${boards.techniques} & ${bit}) != 0`);
    }
  }

  // Filter by techniques value (e.g., techniques=0 for boards without techniques)
  if (techniques !== undefined) {
    const techniquesNum = parseInt(techniques, 10);
    if (!isNaN(techniquesNum)) {
      if (techniquesNum === 0) {
        // Include both 0 and NULL
        query = query.where(sql`${boards.techniques} = 0 OR ${boards.techniques} IS NULL`);
      } else {
        query = query.where(eq(boards.techniques, techniquesNum));
      }
    }
  }

  // Order and limit/offset
  query = query.orderBy(desc(boards.created_at));
  if (offset) {
    const offsetNum = parseInt(offset, 10);
    if (!isNaN(offsetNum) && offsetNum >= 0) {
      query = query.offset(offsetNum);
    }
  }
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum) && limitNum > 0) {
      query = query.limit(limitNum);
    }
  }

  const rows = await query;
  return c.json(successResponse(rows));
});

// GET board counts (public)
boardsRouter.get("/counts", async c => {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(boards);

  const [zeroTechniquesResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(boards)
    .where(sql`${boards.techniques} = 0 OR ${boards.techniques} IS NULL`);

  return c.json(successResponse({
    total: totalResult?.count ?? 0,
    withoutTechniques: zeroTechniquesResult?.count ?? 0,
  }));
});

// GET random board (public)
boardsRouter.get("/random", async c => {
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

// GET one board by uuid (public)
boardsRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db.select().from(boards).where(eq(boards.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Board not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// POST create board (admin only)
boardsRouter.post(
  "/",
  adminMiddleware,
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

// PUT update board (admin only)
boardsRouter.put(
  "/:uuid",
  adminMiddleware,
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

// DELETE board (admin only)
boardsRouter.delete(
  "/:uuid",
  adminMiddleware,
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
