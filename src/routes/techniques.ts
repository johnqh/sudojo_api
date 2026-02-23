/**
 * @fileoverview Technique routes for Sudojo API
 *
 * Provides CRUD endpoints for Sudoku solving techniques (1-60).
 * Each technique belongs to a difficulty level and can be looked up by path slug.
 * Public endpoints: GET (list with optional level filter, get by technique number or path)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

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

/**
 * GET /api/v1/techniques
 *
 * List all techniques, optionally filtered by level.
 *
 * @public No authentication required
 * @query level - Optional integer to filter techniques by difficulty level
 * @returns 200 - Array of technique objects ordered by title
 */
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

/**
 * GET /api/v1/techniques/path/:path
 *
 * Get a single technique by its URL-friendly path slug.
 *
 * @public No authentication required
 * @param path - URL path slug (e.g., "naked-single")
 * @returns 200 - Technique object
 * @returns 404 - Technique not found
 */
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

/**
 * GET /api/v1/techniques/:technique
 *
 * Get a single technique by its technique number.
 *
 * @public No authentication required
 * @param technique - Integer 1-60
 * @returns 200 - Technique object
 * @returns 404 - Technique not found
 */
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

/**
 * POST /api/v1/techniques
 *
 * Create a new solving technique. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body techniqueCreateSchema - { technique, level, title, text? }
 * @returns 201 - Created technique object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
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

/**
 * PUT /api/v1/techniques/:technique
 *
 * Update an existing technique. Requires admin authentication.
 * Only provided fields are updated; omitted fields retain their current values.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param technique - Integer 1-60
 * @body techniqueUpdateSchema - { level?, title?, text? }
 * @returns 200 - Updated technique object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Technique not found
 */
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

/**
 * DELETE /api/v1/techniques/:technique
 *
 * Delete a technique. Requires admin authentication.
 * Cascades to learning entries referencing this technique.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param technique - Integer 1-60
 * @returns 200 - Deleted technique object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Technique not found
 */
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
