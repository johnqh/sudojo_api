import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { db, techniques } from "../db";
import {
  techniqueCreateSchema,
  techniqueUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { authMiddleware } from "../middleware/auth";
import { createAccessControlMiddleware } from "../middleware/accessControl";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const techniquesRouter = new Hono();
const accessControl = createAccessControlMiddleware("techniques");

// GET all techniques (requires auth + access control)
techniquesRouter.get("/", accessControl, async c => {
  const levelUuid = c.req.query("level_uuid");

  let rows;
  if (levelUuid) {
    rows = await db
      .select()
      .from(techniques)
      .where(eq(techniques.level_uuid, levelUuid))
      .orderBy(asc(techniques.index));
  } else {
    rows = await db
      .select()
      .from(techniques)
      .orderBy(asc(techniques.level_uuid), asc(techniques.index));
  }

  return c.json(successResponse(rows));
});

// GET one technique by uuid (requires auth + access control)
techniquesRouter.get(
  "/:uuid",
  accessControl,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const rows = await db
      .select()
      .from(techniques)
      .where(eq(techniques.uuid, uuid));

    if (rows.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// POST create technique (requires auth + access control + admin)
techniquesRouter.post(
  "/",
  accessControl,
  authMiddleware,
  zValidator("json", techniqueCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(techniques)
      .values({
        level_uuid: body.level_uuid,
        index: body.index,
        title: body.title,
        text: body.text,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update technique (requires auth + access control + admin)
techniquesRouter.put(
  "/:uuid",
  accessControl,
  authMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", techniqueUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(techniques)
      .where(eq(techniques.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(techniques)
      .set({
        level_uuid: body.level_uuid ?? current.level_uuid,
        index: body.index ?? current.index,
        title: body.title ?? current.title,
        text: body.text ?? current.text,
        updated_at: new Date(),
      })
      .where(eq(techniques.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

// DELETE technique (requires auth + access control + admin)
techniquesRouter.delete(
  "/:uuid",
  accessControl,
  authMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(techniques)
      .where(eq(techniques.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Technique not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default techniquesRouter;
