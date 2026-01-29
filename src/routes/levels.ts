import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { db, levels } from "../db";
import {
  levelCreateSchema,
  levelUpdateSchema,
  levelParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const levelsRouter = new Hono();

// GET all levels (public)
levelsRouter.get("/", async c => {
  const rows = await db.select().from(levels).orderBy(asc(levels.level));
  return c.json(successResponse(rows));
});

// GET one level by level number (public)
levelsRouter.get("/:level", zValidator("param", levelParamSchema), async c => {
  const { level } = c.req.valid("param");
  const rows = await db.select().from(levels).where(eq(levels.level, level));

  if (rows.length === 0) {
    return c.json(errorResponse("Level not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// POST create level (requires admin auth)
levelsRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", levelCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(levels)
      .values({
        level: body.level,
        title: body.title,
        text: body.text,
        requires_subscription: body.requires_subscription,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update level (requires admin auth)
levelsRouter.put(
  "/:level",
  adminMiddleware,
  zValidator("param", levelParamSchema),
  zValidator("json", levelUpdateSchema),
  async c => {
    const { level } = c.req.valid("param");
    const body = c.req.valid("json");

    // Check if level exists
    const existing = await db
      .select()
      .from(levels)
      .where(eq(levels.level, level));
    if (existing.length === 0) {
      return c.json(errorResponse("Level not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(levels)
      .set({
        title: body.title ?? current.title,
        text: body.text ?? current.text,
        requires_subscription:
          body.requires_subscription ?? current.requires_subscription,
        updated_at: new Date(),
      })
      .where(eq(levels.level, level))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

// DELETE level (requires admin auth)
levelsRouter.delete(
  "/:level",
  adminMiddleware,
  zValidator("param", levelParamSchema),
  async c => {
    const { level } = c.req.valid("param");

    const rows = await db
      .delete(levels)
      .where(eq(levels.level, level))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Level not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default levelsRouter;
