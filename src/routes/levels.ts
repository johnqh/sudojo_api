import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { db, levels } from "../db";
import {
  levelCreateSchema,
  levelUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { authMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const levelsRouter = new Hono();

// GET all levels (public)
levelsRouter.get("/", async c => {
  const rows = await db.select().from(levels).orderBy(asc(levels.index));
  return c.json(successResponse(rows));
});

// GET one level by uuid (public)
levelsRouter.get(
  "/:uuid",
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const rows = await db.select().from(levels).where(eq(levels.uuid, uuid));

    if (rows.length === 0) {
      return c.json(errorResponse("Level not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// POST create level (requires admin auth)
levelsRouter.post(
  "/",
  authMiddleware,
  zValidator("json", levelCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(levels)
      .values({
        index: body.index,
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
  "/:uuid",
  authMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", levelUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    // Check if level exists
    const existing = await db
      .select()
      .from(levels)
      .where(eq(levels.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Level not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(levels)
      .set({
        index: body.index ?? current.index,
        title: body.title ?? current.title,
        text: body.text ?? current.text,
        requires_subscription:
          body.requires_subscription ?? current.requires_subscription,
        updated_at: new Date(),
      })
      .where(eq(levels.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

// DELETE level (requires admin auth)
levelsRouter.delete(
  "/:uuid",
  authMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(levels)
      .where(eq(levels.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Level not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default levelsRouter;
