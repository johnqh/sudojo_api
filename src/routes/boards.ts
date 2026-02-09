import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, desc, sql } from "drizzle-orm";
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
  const levelParam = c.req.query("level");
  const techniqueBit = c.req.query("technique_bit");
  const techniques = c.req.query("techniques");
  const limit = c.req.query("limit");
  const offset = c.req.query("offset");

  let query = db.select().from(boards).$dynamic();

  // Filter by level if provided
  if (levelParam) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      query = query.where(eq(boards.level, level));
    }
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

// GET board counts by technique (public)
// Returns count of boards for each technique bit (1-37)
// Uses BigInt for bit calculation to support techniques >= 32
boardsRouter.get("/counts/by-technique", async c => {
  const counts: Record<number, number> = {};

  // Query count for each technique bit (1-37)
  // TechniqueId enum goes from 1 (FULL_HOUSE) to 37 (MEDUSA_COLORING)
  for (let technique = 1; technique <= 37; technique++) {
    // Use BigInt to avoid 32-bit overflow for techniques >= 32
    const bit = Number(BigInt(1) << BigInt(technique));
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(boards)
      .where(sql`(${boards.techniques} & ${bit}) != 0`);
    counts[technique] = result?.count ?? 0;
  }

  return c.json(successResponse(counts));
});

// GET random board (public)
boardsRouter.get("/random", async c => {
  const levelParam = c.req.query("level");
  const symmetricalParam = c.req.query("symmetrical");

  const conditions = [];

  if (levelParam) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      conditions.push(eq(boards.level, level));
    }
  }

  if (symmetricalParam === "true") {
    conditions.push(eq(boards.symmetrical, true));
  }

  const rows = await db
    .select()
    .from(boards)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`RANDOM()`)
    .limit(1);

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
        level: body.level ?? null,
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
        level:
          body.level !== undefined ? body.level : current.level,
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
