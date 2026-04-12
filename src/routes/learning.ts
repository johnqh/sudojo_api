/**
 * @fileoverview Learning routes for Sudojo API
 *
 * Provides CRUD endpoints for learning content entries.
 * Each entry belongs to a technique and contains instructional text/images
 * in a specific language, ordered by index for sequential display.
 * Public endpoints: GET (list with technique/language filters, get by UUID)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db, learning, techniques } from "../db";
import {
  learningCreateSchema,
  learningUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  type Learning,
} from "@sudobility/sudojo_types";
import { learningLocalization } from "../lib/localization";

const learningRouter = new Hono();

/**
 * GET /api/v1/learning
 *
 * List all learning entries with optional filtering.
 *
 * @public No authentication required
 * @query technique - Optional integer to filter by technique number
 * @query language_code - Optional string to filter by language (e.g., "en")
 * @returns 200 - Array of learning entry objects ordered by technique and index
 */
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

  // Look up technique paths for localization
  const techniqueNumbers = [
    ...new Set(
      rows.map(r => r.technique).filter((t): t is number => t !== null)
    ),
  ];
  const techPathRows =
    techniqueNumbers.length > 0
      ? await db
          .select({ technique: techniques.technique, path: techniques.path })
          .from(techniques)
          .where(inArray(techniques.technique, techniqueNumbers))
      : [];
  const techPathMap = new Map(techPathRows.map(t => [t.technique, t.path]));

  const withLocalization: Learning[] = rows.map(row => ({
    ...row,
    localization: learningLocalization(
      row.technique ? (techPathMap.get(row.technique) ?? null) : null,
      row.index
    ),
  }));
  return c.json(successResponse(withLocalization));
});

/**
 * GET /api/v1/learning/:uuid
 *
 * Get a single learning entry by UUID.
 *
 * @public No authentication required
 * @param uuid - Valid UUID string
 * @returns 200 - Learning entry object
 * @returns 404 - Learning entry not found
 */
learningRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db.select().from(learning).where(eq(learning.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Learning entry not found"), 404);
  }

  const row = rows[0];
  // Look up technique path for localization
  let techniquePath: string | null = null;
  if (row.technique !== null) {
    const techRows = await db
      .select({ path: techniques.path })
      .from(techniques)
      .where(eq(techniques.technique, row.technique));
    if (techRows.length > 0) {
      techniquePath = techRows[0].path;
    }
  }

  const learningItem: Learning = {
    ...row,
    localization: learningLocalization(techniquePath, row.index),
  };
  return c.json(successResponse(learningItem));
});

/**
 * POST /api/v1/learning
 *
 * Create a new learning entry. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body learningCreateSchema - { technique, index, language_code?, text?, image_url? }
 * @returns 201 - Created learning entry object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 */
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

    return c.json(successResponse(rows[0] as Learning), 201);
  }
);

/**
 * PUT /api/v1/learning/:uuid
 *
 * Update an existing learning entry. Requires admin authentication.
 * Only provided fields are updated; omitted fields retain their current values.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @body learningUpdateSchema - { technique?, index?, language_code?, text?, image_url? }
 * @returns 200 - Updated learning entry object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Learning entry not found
 */
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

    return c.json(successResponse(rows[0] as Learning));
  }
);

/**
 * DELETE /api/v1/learning/:uuid
 *
 * Delete a learning entry. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - Valid UUID string
 * @returns 200 - Deleted learning entry object
 * @returns 401 - Missing or invalid auth token
 * @returns 403 - Not an admin user
 * @returns 404 - Learning entry not found
 */
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

    return c.json(successResponse(rows[0] as Learning));
  }
);

export default learningRouter;
