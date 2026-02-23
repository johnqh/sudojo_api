/**
 * @fileoverview Level routes for Sudojo API
 *
 * Provides CRUD endpoints for difficulty levels (1-12).
 * Public endpoints: GET (list, get by level number)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

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

/**
 * GET /api/v1/levels
 *
 * List all difficulty levels, ordered ascending by level number.
 *
 * @public No authentication required
 * @returns 200 - Array of level objects
 */
levelsRouter.get("/", async c => {
  const rows = await db.select().from(levels).orderBy(asc(levels.level));
  return c.json(successResponse(rows));
});

/**
 * GET /api/v1/levels/:level
 *
 * Get a single level by its level number.
 *
 * @public No authentication required
 * @param level - Integer 1-12, validated by levelParamSchema
 * @returns 200 - Level object
 * @returns 404 - Level not found
 */
levelsRouter.get("/:level", zValidator("param", levelParamSchema), async c => {
  const { level } = c.req.valid("param");
  const rows = await db.select().from(levels).where(eq(levels.level, level));

  if (rows.length === 0) {
    return c.json(errorResponse("Level not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

/**
 * POST /api/v1/levels
 *
 * Create a new difficulty level. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body levelCreateSchema - { level, title, text?, requires_subscription? }
 * @returns 201 - Created level object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
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

/**
 * PUT /api/v1/levels/:level
 *
 * Update an existing difficulty level. Requires admin authentication.
 * Only provided fields are updated; omitted fields retain their current values.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param level - Integer 1-12
 * @body levelUpdateSchema - { title?, text?, requires_subscription? }
 * @returns 200 - Updated level object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Level not found
 */
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

/**
 * DELETE /api/v1/levels/:level
 *
 * Delete a difficulty level. Requires admin authentication.
 * Cascades to techniques referencing this level.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param level - Integer 1-12
 * @returns 200 - Deleted level object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Level not found
 */
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
