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
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const practicesRouter = new Hono();

// GET practice counts for all techniques (public)
// Returns list of techniques with their practice counts
practicesRouter.get("/counts", async c => {
  const rows = await db
    .select({
      technique: techniques.technique,
      technique_title: techniques.title,
      count: sql<number>`COALESCE(
        (SELECT COUNT(*) FROM technique_practices WHERE technique_practices.technique = techniques.technique),
        0
      )::int`,
    })
    .from(techniques)
    .orderBy(techniques.technique);

  return c.json(successResponse(rows));
});

// GET random practice for a technique (public)
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
      return c.json(errorResponse("No practices found for this technique"), 404);
    }

    return c.json(successResponse(rows[0]));
  }
);

// GET one practice by uuid (public)
practicesRouter.get("/:uuid", zValidator("param", uuidParamSchema), async c => {
  const { uuid } = c.req.valid("param");
  const rows = await db
    .select()
    .from(techniquePractices)
    .where(eq(techniquePractices.uuid, uuid));

  if (rows.length === 0) {
    return c.json(errorResponse("Practice not found"), 404);
  }

  return c.json(successResponse(rows[0]));
});

// POST create practice (admin only)
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

    return c.json(successResponse(rows[0]), 201);
  }
);

// DELETE all practices (admin only, requires ?confirm=true)
practicesRouter.delete("/", adminMiddleware, async c => {
  const confirm = c.req.query("confirm");

  if (confirm !== "true") {
    return c.json(
      errorResponse("Must pass ?confirm=true to delete all practices"),
      400
    );
  }

  const result = await db.delete(techniquePractices).returning();

  return c.json(
    successResponse({
      deleted: result.length,
      message: `Deleted ${result.length} practices`,
    })
  );
});

// DELETE practice by uuid (admin only)
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

    return c.json(successResponse(rows[0]));
  }
);

export default practicesRouter;
