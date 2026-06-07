/**
 * @fileoverview Community routes for Sudojo API
 *
 * Provides CRUD endpoints for curated Sudoku communities and forums.
 * Communities are language-specific: different records per language.
 * Public endpoints: GET (list with language filter, get by UUID)
 * Admin endpoints: POST, PUT, DELETE (require Firebase admin auth)
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, asc } from "drizzle-orm";
import { db, communities } from "../db";
import {
  communityCreateSchema,
  communityUpdateSchema,
  uuidParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  type Community,
} from "@sudobility/sudojo_types";

const communitiesRouter = new Hono();

/**
 * GET /api/v1/communities
 *
 * List communities, optionally filtered by language code.
 *
 * @public No authentication required
 * @query language - Optional language code to filter (e.g., "en", "ja")
 * @returns 200 - Array of community objects ordered by sort_order, name
 */
communitiesRouter.get("/", async c => {
  const languageParam = c.req.query("language");

  let rows;
  if (languageParam) {
    rows = await db
      .select()
      .from(communities)
      .where(eq(communities.language_code, languageParam))
      .orderBy(asc(communities.sort_order), asc(communities.name));
  } else {
    rows = await db
      .select()
      .from(communities)
      .orderBy(
        asc(communities.language_code),
        asc(communities.sort_order),
        asc(communities.name)
      );
  }

  return c.json(successResponse(rows as Community[]));
});

/**
 * GET /api/v1/communities/:uuid
 *
 * Get a single community by UUID.
 *
 * @public No authentication required
 * @param uuid - UUID v4
 * @returns 200 - Community object
 * @returns 404 - Community not found
 */
communitiesRouter.get(
  "/:uuid",
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const rows = await db
      .select()
      .from(communities)
      .where(eq(communities.uuid, uuid));

    if (rows.length === 0) {
      return c.json(errorResponse("Community not found"), 404);
    }

    return c.json(successResponse(rows[0] as Community));
  }
);

/**
 * POST /api/v1/communities
 *
 * Create a new community. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @body communityCreateSchema
 * @returns 201 - Created community object
 */
communitiesRouter.post(
  "/",
  adminMiddleware,
  zValidator("json", communityCreateSchema),
  async c => {
    const body = c.req.valid("json");

    const rows = await db
      .insert(communities)
      .values({
        language_code: body.language_code,
        name: body.name,
        name_english: body.name_english ?? null,
        description: body.description,
        url: body.url,
        platform: body.platform,
        sort_order: body.sort_order ?? 0,
        icon_url: body.icon_url ?? null,
      })
      .returning();

    return c.json(successResponse(rows[0] as Community), 201);
  }
);

/**
 * PUT /api/v1/communities/:uuid
 *
 * Update an existing community. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - UUID v4
 * @body communityUpdateSchema
 * @returns 200 - Updated community object
 * @returns 404 - Community not found
 */
communitiesRouter.put(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  zValidator("json", communityUpdateSchema),
  async c => {
    const { uuid } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db
      .select()
      .from(communities)
      .where(eq(communities.uuid, uuid));
    if (existing.length === 0) {
      return c.json(errorResponse("Community not found"), 404);
    }

    const current = existing[0]!;
    const rows = await db
      .update(communities)
      .set({
        language_code: body.language_code ?? current.language_code,
        name: body.name ?? current.name,
        name_english:
          body.name_english !== undefined
            ? body.name_english
            : current.name_english,
        description: body.description ?? current.description,
        url: body.url ?? current.url,
        platform: body.platform ?? current.platform,
        sort_order:
          body.sort_order !== undefined ? body.sort_order : current.sort_order,
        icon_url:
          body.icon_url !== undefined ? body.icon_url : current.icon_url,
        updated_at: new Date(),
      })
      .where(eq(communities.uuid, uuid))
      .returning();

    return c.json(successResponse(rows[0] as Community));
  }
);

/**
 * DELETE /api/v1/communities/:uuid
 *
 * Delete a community. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @param uuid - UUID v4
 * @returns 200 - Deleted community object
 * @returns 404 - Community not found
 */
communitiesRouter.delete(
  "/:uuid",
  adminMiddleware,
  zValidator("param", uuidParamSchema),
  async c => {
    const { uuid } = c.req.valid("param");

    const rows = await db
      .delete(communities)
      .where(eq(communities.uuid, uuid))
      .returning();

    if (rows.length === 0) {
      return c.json(errorResponse("Community not found"), 404);
    }

    return c.json(successResponse(rows[0] as Community));
  }
);

export default communitiesRouter;
