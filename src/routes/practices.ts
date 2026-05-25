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
import {
  db,
  boards,
  techniquePractices,
  techniqueExamples,
  techniques,
} from "../db";
import {
  techniquePracticeCreateSchema,
  uuidParamSchema,
  techniqueParamSchema,
} from "../schemas";
import { adminMiddleware } from "../middleware/auth";
import {
  successResponse,
  errorResponse,
  EMPTY_PENCILMARKS,
  hasPencilmarkContent,
  type TechniquePractice,
  type TechniquePracticeCountItem,
  type SolverHintStep,
  type PracticesBulkDeleteData,
} from "@sudobility/sudojo_types";
import {
  techniqueTitleLocalization,
  hintTitleLocalization,
} from "../lib/localization";
import { callSolver } from "../services/solver-proxy";

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

/**
 * POST /api/v1/practices/regenerate-hints
 *
 * Regenerate hint_data for all examples and practices by calling the solver.
 * Updates each row's stored hint_data with fresh solver output
 * including all detailed steps. Requires admin authentication.
 *
 * @auth Admin (Firebase token + SITEADMIN_EMAILS check)
 * @returns 200 - { examples: { updated, failed, total }, practices: { updated, failed, total }, failures }
 */
practicesRouter.post("/regenerate-hints", adminMiddleware, async c => {
  // Cache technique paths
  const techRows = await db
    .select({ technique: techniques.technique, path: techniques.path })
    .from(techniques);
  const techPathMap = new Map(techRows.map(r => [r.technique, r.path]));

  const failures: {
    uuid: string;
    table: string;
    technique: number | null;
    reason: string;
  }[] = [];

  // Helper to regenerate hint_data for a single row
  const regenerateRow = async (
    row: {
      uuid: string;
      original: string;
      board: string;
      pencilmarks: string | null;
      technique: number;
    },
    table: string,
    updateFn: (uuid: string, hintData: string) => Promise<void>
  ): Promise<boolean> => {
    try {
      const hasPencilmarks =
        row.pencilmarks != null && hasPencilmarkContent(row.pencilmarks);
      const result = await callSolver(
        row.original,
        row.board,
        "false",
        hasPencilmarks ? row.pencilmarks! : EMPTY_PENCILMARKS,
        row.technique.toString()
      );

      if (!result.success) {
        const msg = result.error?.message ?? "Solver returned failure";
        console.warn(`[regenerate] Failed ${table} ${row.uuid}: ${msg}`);
        failures.push({
          uuid: row.uuid,
          table,
          technique: row.technique,
          reason: msg,
        });
        return false;
      }

      if (!result.data?.hints?.steps?.length) {
        console.warn(
          `[regenerate] No steps for ${table} ${row.uuid} (technique ${row.technique})`
        );
        failures.push({
          uuid: row.uuid,
          table,
          technique: row.technique,
          reason: "Solver returned no steps",
        });
        return false;
      }

      const techniquePath = techPathMap.get(row.technique) ?? null;
      const titleLoc = hintTitleLocalization(techniquePath);

      const steps = result.data.hints.steps.map((step: SolverHintStep) => {
        const existing = step.localization as
          | { stringKey?: string; values?: string[] }
          | { text?: { stringKey: string; values: string[] } }
          | undefined;
        let textLoc: { stringKey: string; values: string[] } | undefined;
        if (existing && "stringKey" in existing && existing.stringKey) {
          textLoc = {
            stringKey: existing.stringKey,
            values: existing.values ?? [],
          };
        } else if (existing && "text" in existing && existing.text) {
          textLoc = existing.text;
        }

        return {
          ...step,
          localization: {
            ...(textLoc ? { text: textLoc } : {}),
            ...(titleLoc ? { title: titleLoc } : {}),
          },
        };
      });

      const hintData = JSON.stringify({
        ...result.data.hints,
        steps,
      });

      await updateFn(row.uuid, hintData);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[regenerate] Error for ${table} ${row.uuid} (technique ${row.technique}):`,
        msg
      );
      failures.push({
        uuid: row.uuid,
        table,
        technique: row.technique,
        reason: msg,
      });
      return false;
    }
  };

  // Regenerate technique_examples (join with source board for original puzzle)
  const allExamples = await db
    .select({
      uuid: techniqueExamples.uuid,
      board: techniqueExamples.board,
      pencilmarks: techniqueExamples.pencilmarks,
      primary_technique: techniqueExamples.primary_technique,
      source_board: boards.board,
    })
    .from(techniqueExamples)
    .leftJoin(boards, eq(techniqueExamples.source_board_uuid, boards.uuid));
  let examplesUpdated = 0;

  for (const example of allExamples) {
    if (!example.source_board) {
      failures.push({
        uuid: example.uuid,
        table: "technique_examples",
        technique: example.primary_technique,
        reason: "No source board found",
      });
      continue;
    }
    const success = await regenerateRow(
      {
        uuid: example.uuid,
        original: example.source_board,
        board: example.board,
        pencilmarks: example.pencilmarks,
        technique: example.primary_technique,
      },
      "technique_examples",
      async (uuid, hintData) => {
        await db
          .update(techniqueExamples)
          .set({ hint_data: hintData })
          .where(eq(techniqueExamples.uuid, uuid));
      }
    );
    if (success) examplesUpdated++;
  }

  // Regenerate technique_practices
  const allPractices = await db.select().from(techniquePractices);
  let practicesUpdated = 0;

  for (const practice of allPractices) {
    const success = await regenerateRow(
      {
        uuid: practice.uuid,
        original: practice.board,
        board: practice.board,
        pencilmarks: practice.pencilmarks,
        technique: practice.technique!,
      },
      "technique_practices",
      async (uuid, hintData) => {
        await db
          .update(techniquePractices)
          .set({ hint_data: hintData })
          .where(eq(techniquePractices.uuid, uuid));
      }
    );
    if (success) practicesUpdated++;
  }

  return c.json(
    successResponse({
      examples: {
        updated: examplesUpdated,
        failed: allExamples.length - examplesUpdated,
        total: allExamples.length,
      },
      practices: {
        updated: practicesUpdated,
        failed: allPractices.length - practicesUpdated,
        total: allPractices.length,
      },
      updated: examplesUpdated + practicesUpdated,
      failed: failures.length,
      total: allExamples.length + allPractices.length,
      failures,
    })
  );
});

export default practicesRouter;
