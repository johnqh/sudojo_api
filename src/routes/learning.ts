import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc } from "drizzle-orm";
import { db, learning } from "../db";
import {
  learningCreateSchema,
  learningUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const learningRouter = new Hono();

// GET all learning entries (public)
learningRouter.get("/", async c => {
  const techniqueParam = c.req.query("technique");
  const languageCode = c.req.query("language_code");

  let rows;
  if (techniqueParam && languageCode) {
    const technique = parseInt(techniqueParam, 10);
    if (!isNaN(technique)) {
      rows = await db
        .select()
        .from(learning)
        .where(
          and(
            eq(learning.technique, technique),
            eq(learning.language_code, languageCode)
          )
        )
        .orderBy(asc(learning.index));
    } else {
      rows = await db
        .select()
        .from(learning)
        .orderBy(asc(learning.technique), asc(learning.index));
    }
  } else if (techniqueParam) {
    const technique = parseInt(techniqueParam, 10);
    if (!isNaN(technique)) {
      rows = await db
        .select()
        .from(learning)
        .where(eq(learning.technique, technique))
        .orderBy(asc(learning.index));
    } else {
      rows = await db
        .select()
        .from(learning)
        .orderBy(asc(learning.technique), asc(learning.index));
    }
  } else if (languageCode) {
    rows = await db
      .select()
      .from(learning)
      .where(eq(learning.language_code, languageCode))
      .orderBy(asc(learning.technique), asc(learning.index));
  } else {
    rows = await db
      .select()
      .from(learning)
      .orderBy(asc(learning.technique), asc(learning.index));
  }

  return c.json(successResponse(rows));
});

// GET one learning entry by uuid (public)
learningRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db.select().from(learning).where(eq(learning.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Learning entry not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// POST create learning entry (requires admin auth)
learningRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", learningCreateSchema),
  async c => {
    const body = c.req.valid("json");

    // Use type assertion to work around drizzle-orm type inference issue
    // with foreign key references in insert values
    const insertValues = {
      technique: body.technique,
      index: body.index,
      language_code: body.language_code,
      text: body.text,
      image_url: body.image_url ?? null,
    } as typeof learning.$inferInsert;

    const rows = await db.insert(learning).values(insertValues).returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

// PUT update learning entry (requires admin auth)
learningRouter.put(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", learningUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(learning)
      .where(eq(learning.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Learning entry not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(learning)
      .set({
        technique: body.technique ?? current.technique,
        index: body.index ?? current.index,
        language_code: body.language_code ?? current.language_code,
        text: body.text ?? current.text,
        image_url:
          body.image_url !== undefined ? body.image_url : current.image_url,
        updated_at: new Date(),
      })
      .where(eq(learning.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

// DELETE learning entry (requires admin auth)
learningRouter.delete(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(learning)
      .where(eq(learning.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Learning entry not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

export default learningRouter;
