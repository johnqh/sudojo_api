/**
 * @fileoverview Practice routes for Sudojo API
 *
 * Provides CRUD endpoints for technique practice puzzles.
 * Each practice is a simplified board state designed for practicing
 * a specific technique, derived from technique examples.
 * Public endpoints: GET (counts, random by technique, get by UUID)
 * Admin endpoints: POST, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, sql } from "drizzle-orm";
import { db, techniquePractices, techniques } from "../db";
import {
  techniquePracticeCreateSchema,
  uuidParamSchema,
  techniqueParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  type TechniquePractice,
  type TechniquePracticeCountItem,
  type PracticesBulkDeleteData,
} from "@sudobility/sudojo_types";
import { techniqueTitleLocalization } from "../lib/localization";

const practicesRouter = new Hono();

/**
 * GET /api/v1/practices/counts
 *
 * Get practice counts for all techniques.
 * Returns each technique with its associated practice puzzle count.
 *
 * @public No authentication required
 * @returns 200 - Array of { technique, technique_title, count }
 */
practicesRouter.get("/counts", async c => {
  const rows = await db
    .select({
      technique: techniques.technique,
      technique_title: techniques.title,
      technique_path: techniques.path,
      count: sql<number>`COALESCE(
        (SELECT COUNT(*) FROM technique_practices WHERE technique_practices.technique = techniques.technique),
        0
      )::int`,
    })
    .from(techniques)
    .orderBy(techniques.technique);

  const withLocalization: TechniquePracticeCountItem[] = rows.map(row => ({
    technique: row.technique,
    technique_title: row.technique_title,
    count: row.count,
    localization: techniqueTitleLocalization(row.technique_path),
  }));
  return c.json(successResponse(withLocalization));
});

/**
 * GET /api/v1/practices/technique/:technique/random
 *
 * Get a random practice puzzle for a specific technique.
 *
 * @public No authentication required
 * @param technique - Integer 1-60
 * @returns 200 - Single practice object
 * @returns 404 - No practices found for this technique
 */
practicesRouter.get(
  "/technique/:technique/random",
  zValidator("param", techniqueParamSchema),
  async c => {
    const { technique } = c.req.valid("param");

    const rows = await db
      .select()
      .from(techniquePractices)
      .where(eq(techniquePractices.technique, technique))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (rows.length === 0) {
      return c.json(
        errorResponse("No practices found for this technique"),
        404
      );
    }

    return c.json(successResponse(rows[0] as TechniquePractice));
  }
);

/**
 * GET /api/v1/practices/:uuid
 *
 * Get a single practice puzzle by UUID.
 *
 * @public No authentication required
 * @param uuid - Valid UUID string
 * @returns 200 - Practice object
 * @returns 404 - Practice not found
 */
practicesRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db
    .select()
    .from(techniquePractices)
    .where(eq(techniquePractices.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Practice not found"), 404);
  }

  return c.json(successResponse(rows[0] as TechniquePractice));
});

/**
 * POST /api/v1/practices
 *
 * Create a new practice puzzle. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body techniquePracticeCreateSchema
 * @returns 201 - Created practice object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
practicesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", techniquePracticeCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(techniquePractices)
      .values({
        technique: body.technique,
        board: body.board,
        pencilmarks: body.pencilmarks ?? null,
        solution: body.solution,
        hint_data: body.hint_data ?? null,
        source_example_uuid: body.source_example_uuid ?? null,
      })
      .returning();

    return c.json(successResponse(rows[0] as TechniquePractice), 201);
  }
);

/**
 * DELETE /api/v1/practices
 *
 * Delete all practice puzzles. Requires admin authentication
 * and a `confirm=true` query parameter as a safety check.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @query confirm - Must be "true" to proceed
 * @returns 200 - { deleted: number, message: string }
 * @returns 400 - Missing confirm=true query parameter
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
practicesRouter.delete("/", adminMiddleware, async c => {
  const confirm = c.req.query("confirm");

  if (confirm !== "true") {
    return c.json(
      errorResponse("Query parameter confirm=true is required"),
      400
    );
  }

  const rows = await db.delete(techniquePractices).returning();

  const deleteResult: PracticesBulkDeleteData = {
    deleted: rows.length,
    message: `Deleted ${rows.length} practice(s)`,
  };
  return c.json(successResponse(deleteResult));
});

/**
 * DELETE /api/v1/practices/:uuid
 *
 * Delete a single practice puzzle. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @returns 200 - Deleted practice object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Practice not found
 */
practicesRouter.delete(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(techniquePractices)
      .where(eq(techniquePractices.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Practice not found"), 404);
    }

    return c.json(successResponse(rows[0] as TechniquePractice));
  }
);

export default practicesRouter;
