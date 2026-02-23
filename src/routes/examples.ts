/**
 * @fileoverview Technique example routes for Sudojo API
 *
 * Provides CRUD endpoints for technique tutorial examples.
 * Each example captures a specific board state where a technique applies,
 * with associated hint data for instructional display.
 * Public endpoints: GET (list with filters, counts, random, get by UUID)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, desc, sql } from "drizzle-orm";
import { db, techniqueExamples } from "../db";
import {
  techniqueExampleCreateSchema,
  techniqueExampleUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  techniqueToBit,
  ALL_TECHNIQUE_IDS,
  type TechniqueId,
} from "@sudobility/sudojo_types";

const examplesRouter = new Hono();

/**
 * GET /api/v1/examples
 *
 * List all technique examples with optional filtering.
 *
 * @public No authentication required
 * @query technique - Filter by primary_technique ID (integer)
 * @query has_technique - Filter by techniques_bitfield containing this technique bit
 * @returns 200 - Array of example objects ordered by created_at desc
 * @returns 400 - Invalid technique ID
 */
examplesRouter.get("/", async c => {
  const technique = c.req.query("technique");
  const hasTechnique = c.req.query("has_technique");

  let rows;
  if (technique) {
    const techniqueId = parseInt(technique, 10);
    if (isNaN(techniqueId) || !ALL_TECHNIQUE_IDS.includes(techniqueId as TechniqueId)) {
      return c.json(errorResponse("Invalid technique ID"), 400);
    }
    rows = await db
      .select()
      .from(techniqueExamples)
      .where(eq(techniqueExamples.primary_technique, techniqueId))
      .orderBy(desc(techniqueExamples.created_at));
  } else if (hasTechnique) {
    const techniqueId = parseInt(hasTechnique, 10);
    if (isNaN(techniqueId) || !ALL_TECHNIQUE_IDS.includes(techniqueId as TechniqueId)) {
      return c.json(errorResponse("Invalid technique ID"), 400);
    }
    const bit = techniqueToBit(techniqueId as TechniqueId);
    rows = await db
      .select()
      .from(techniqueExamples)
      .where(sql`(${techniqueExamples.techniques_bitfield} & ${bit}) != 0`)
      .orderBy(desc(techniqueExamples.created_at));
  } else {
    rows = await db
      .select()
      .from(techniqueExamples)
      .orderBy(desc(techniqueExamples.created_at));
  }

  return c.json(successResponse(rows));
});

/**
 * GET /api/v1/examples/counts
 *
 * Get count of examples grouped by primary_technique.
 *
 * @public No authentication required
 * @returns 200 - Record<number, number> mapping technique ID to count
 */
examplesRouter.get("/counts", async c => {
  const rows = await db
    .select({
      primary_technique: techniqueExamples.primary_technique,
      count: sql<number>`count(*)::int`,
    })
    .from(techniqueExamples)
    .groupBy(techniqueExamples.primary_technique)
    .orderBy(techniqueExamples.primary_technique);

  // Convert to a map for easier consumption
  const counts: Record<number, number> = {};
  for (const row of rows) {
    counts[row.primary_technique] = row.count;
  }

  return c.json(successResponse(counts));
});

/**
 * GET /api/v1/examples/random
 *
 * Get a random technique example, optionally filtered by technique.
 *
 * @public No authentication required
 * @query technique - Filter by primary_technique ID (integer)
 * @returns 200 - Single example object
 * @returns 400 - Invalid technique ID
 * @returns 404 - No examples found
 */
examplesRouter.get("/random", async c => {
  const technique = c.req.query("technique");

  let techniqueId: number | null = null;

  if (technique) {
    techniqueId = parseInt(technique, 10);
    if (isNaN(techniqueId) || !ALL_TECHNIQUE_IDS.includes(techniqueId as TechniqueId)) {
      return c.json(errorResponse("Invalid technique ID"), 400);
    }
  }

  let rows;
  if (techniqueId !== null) {
    rows = await db
      .select()
      .from(techniqueExamples)
      .where(eq(techniqueExamples.primary_technique, techniqueId))
      .orderBy(sql`RANDOM()`)
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(techniqueExamples)
      .orderBy(sql`RANDOM()`)
      .limit(1);
  }

  if (rows.length === 0) {
    return c.json(errorResponse("No examples found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

/**
 * GET /api/v1/examples/:uuid
 *
 * Get a single technique example by UUID.
 *
 * @public No authentication required
 * @param uuid - Valid UUID string
 * @returns 200 - Example object
 * @returns 404 - Example not found
 */
examplesRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db
    .select()
    .from(techniqueExamples)
    .where(eq(techniqueExamples.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Example not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

/**
 * POST /api/v1/examples
 *
 * Create a new technique example. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body techniqueExampleCreateSchema
 * @returns 201 - Created example object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
examplesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", techniqueExampleCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(techniqueExamples)
      .values({
        board: body.board,
        pencilmarks: body.pencilmarks ?? null,
        solution: body.solution,
        techniques_bitfield: body.techniques_bitfield,
        primary_technique: body.primary_technique,
        hint_data: body.hint_data ?? null,
        source_board_uuid: body.source_board_uuid ?? null,
      })
      .returning();

    return c.json(successResponse(rows[0]), 201);
  }
);

/**
 * PUT /api/v1/examples/:uuid
 *
 * Update an existing technique example. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @body techniqueExampleUpdateSchema
 * @returns 200 - Updated example object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Example not found
 */
examplesRouter.put(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", techniqueExampleUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(techniqueExamples)
      .where(eq(techniqueExamples.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Example not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(techniqueExamples)
      .set({
        board: body.board ?? current.board,
        pencilmarks:
          body.pencilmarks !== undefined
            ? body.pencilmarks
            : current.pencilmarks,
        solution: body.solution ?? current.solution,
        techniques_bitfield:
          body.techniques_bitfield ?? current.techniques_bitfield,
        primary_technique: body.primary_technique ?? current.primary_technique,
        hint_data:
          body.hint_data !== undefined ? body.hint_data : current.hint_data,
        source_board_uuid:
          body.source_board_uuid !== undefined
            ? body.source_board_uuid
            : current.source_board_uuid,
      })
      .where(eq(techniqueExamples.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0]));
  }
);

/**
 * DELETE /api/v1/examples/:uuid
 *
 * Delete a single technique example. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @returns 200 - Deleted example object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Example not found
 */
examplesRouter.delete(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(techniqueExamples)
      .where(eq(techniqueExamples.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Example not found"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

/**
 * DELETE /api/v1/examples
 *
 * Delete ALL technique examples. Requires admin authentication and ?confirm=true.
 * This is a destructive operation - use with caution.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @query confirm - Must be "true" to proceed
 * @returns 200 - { deleted: number, message: string }
 * @returns 400 - Missing ?confirm=true
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
examplesRouter.delete("/", adminMiddleware, async c => {
  const confirm = c.req.query("confirm");

  if (confirm !== "true") {
    return c.json(
      errorResponse("Must pass ?confirm=true to delete all examples"),
      400
    );
  }

  const result = await db.delete(techniqueExamples).returning();

  return c.json(
    successResponse({
      deleted: result.length,
      message: `Deleted ${result.length} examples`,
    })
  );
});

export default examplesRouter;
