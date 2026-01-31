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
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const examplesRouter = new Hono();

// GET all examples (public)
// Query params: ?technique=N (filter by primary_technique)
//               ?has_technique=N (filter by techniques_bitfield containing N)
examplesRouter.get("/", async c => {
  const technique = c.req.query("technique");
  const hasTechnique = c.req.query("has_technique");

  let rows;
  if (technique) {
    const techniqueId = parseInt(technique, 10);
    if (isNaN(techniqueId) || techniqueId < 1 || techniqueId > 37) {
      return c.json(errorResponse("Invalid technique ID"), 400);
    }
    rows = await db
      .select()
      .from(techniqueExamples)
      .where(eq(techniqueExamples.primary_technique, techniqueId))
      .orderBy(desc(techniqueExamples.created_at));
  } else if (hasTechnique) {
    const techniqueId = parseInt(hasTechnique, 10);
    if (isNaN(techniqueId) || techniqueId < 1 || techniqueId > 37) {
      return c.json(errorResponse("Invalid technique ID"), 400);
    }
    // Use BigInt for bit shift to support techniques >= 32, then convert to Number
    // (safe for techniques up to 52 which is within Number.MAX_SAFE_INTEGER)
    const bit = Number(BigInt(1) << BigInt(techniqueId - 1));
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

// GET count by technique (public)
// Returns count of examples for each primary_technique
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

// GET random example for a technique (public)
// Query params: ?technique=N (filter by primary_technique)
examplesRouter.get("/random", async c => {
  const technique = c.req.query("technique");

  let techniqueId: number | null = null;

  if (technique) {
    techniqueId = parseInt(technique, 10);
    if (isNaN(techniqueId) || techniqueId < 1 || techniqueId > 37) {
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

// GET one example by uuid (public)
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

// POST create example (admin only)
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

// PUT update example (admin only)
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

// DELETE example (admin only)
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

// DELETE all examples (admin only, requires ?confirm=true)
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
