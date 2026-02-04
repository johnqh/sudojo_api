import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { db, techniques } from "../db";
import {
  techniqueCreateSchema,
  techniqueUpdateSchema,
  techniqueParamSchema,
  techniquePathParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const techniquesRouter = new Hono();

// GET all techniques (public)
techniquesRouter.get("/", async c => {
  const levelParam = c.req.query("level");

  let rows;
  if (levelParam) {
    const level = parseInt(levelParam, 10);
    if (!isNaN(level)) {
      rows = await db
        .select()
        .from(techniques)
        .where(eq(techniques.level, level))
        .orderBy(asc(techniques.title));
    } else {
      rows = await db.select().from(techniques).orderBy(asc(techniques.title));
    }
  } else {
    rows = await db.select().from(techniques).orderBy(asc(techniques.title));
  }

  return c.json(successResponse(rows));
});

// GET one technique by path (public)
techniquesRouter.get(
  "/path/:path",
  zValidator("param", techniquePathParamSchema),
  async c => {
    const { path } = c.req.valid("param");
    const rows = await db
      .select()
      .from(techniques)
      .where(eq(techniques.path, path));

    if (rows.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// GET one technique by technique number (public)
techniquesRouter.get(
  "/:technique",
  zValidator("param", techniqueParamSchema),
  async c => {
    const { technique } = c.req.valid("param");
    const rows = await db
      .select()
      .from(techniques)
      .where(eq(techniques.technique, technique));

    if (rows.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// POST create technique (requires admin auth)
techniquesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", techniqueCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(techniques)
      .values({
        technique: body.technique,
        level: body.level,
        title: body.title,
        text: body.text,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update technique (requires admin auth)
techniquesRouter.put(
  "/:technique",
  adminMiddleware,
  zValidator("param", techniqueParamSchema),
  zValidator("json", techniqueUpdateSchema),
  async c => {
    const { technique } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(techniques)
      .where(eq(techniques.technique, technique));
    if (existing.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(techniques)
      .set({
        level: body.level ?? current.level,
        title: body.title ?? current.title,
        text: body.text ?? current.text,
        updated_at: new Date(),
      })
      .where(eq(techniques.technique, technique))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

// DELETE technique (requires admin auth)
techniquesRouter.delete(
  "/:technique",
  adminMiddleware,
  zValidator("param", techniqueParamSchema),
  async c => {
    const { technique } = c.req.valid("param");

    const rows = await db
      .delete(techniques)
      .where(eq(techniques.technique, technique))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default techniquesRouter;
