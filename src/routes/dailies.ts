import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, sql } from "drizzle-orm";
import { db, dailies } from "../db";
import {
  dailyCreateSchema,
  dailyUpdateSchema,
  uuidParamSchema,
  dateParamSchema,
} from "../schemas";
import { authMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const dailiesRouter = new Hono();

// GET all dailies (public)
dailiesRouter.get("/", async c => {
  const rows = await db.select().from(dailies).orderBy(desc(dailies.date));
  return c.json(successResponse(rows));
});

// GET random daily (public)
dailiesRouter.get("/random", async c => {
  const rows = await db
    .select()
    .from(dailies)
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (rows.length === 0) {
    return c.json(errorResponse("No dailies found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// GET today's daily (public)
dailiesRouter.get("/today", async c => {
  const today = new Date().toISOString().split("T")[0] as string;
  const rows = await db.select().from(dailies).where(eq(dailies.date, today));

  if (rows.length === 0) {
    return c.json(errorResponse("No daily puzzle for today"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// GET daily by date (public)
dailiesRouter.get(
  "/date/:date",
  zValidator("param", dateParamSchema),
  async c => {
    const { date } = c.req.valid("param");
    const rows = await db.select().from(dailies).where(eq(dailies.date, date));

    if (rows.length === 0) {
      return c.json(errorResponse("Daily not found for this date"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// GET one daily by uuid (public)
dailiesRouter.get(
  "/:uuid",
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const rows = await db.select().from(dailies).where(eq(dailies.uuid, uuid));

    if (rows.length === 0) {
      return c.json(errorResponse("Daily not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// POST create daily (admin only)
dailiesRouter.post(
  "/",
  authMiddleware,
  zValidator("json", dailyCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(dailies)
      .values({
        date: body.date,
        board_uuid: body.board_uuid ?? null,
        level_uuid: body.level_uuid ?? null,
        techniques: body.techniques,
        board: body.board,
        solution: body.solution,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update daily (admin only)
dailiesRouter.put(
  "/:uuid",
  authMiddleware,
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
        level_uuid:
          body.level_uuid !== undefined ? body.level_uuid : current.level_uuid,
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

// DELETE daily (admin only)
dailiesRouter.delete(
  "/:uuid",
  authMiddleware,
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
