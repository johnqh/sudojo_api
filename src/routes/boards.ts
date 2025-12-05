import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db";
import { boardCreateSchema, boardUpdateSchema, uuidParamSchema } from "../schemas";
import { authMiddleware } from "../middleware/auth";

const boards = new Hono();

// GET all boards (public)
boards.get("/", async (c) => {
  const levelUuid = c.req.query("level_uuid");

  let rows;
  if (levelUuid) {
    rows = await sql`SELECT * FROM boards WHERE level_uuid = ${levelUuid} ORDER BY created_at DESC`;
  } else {
    rows = await sql`SELECT * FROM boards ORDER BY level_uuid, created_at DESC`;
  }

  return c.json({ data: rows });
});

// GET random board (public)
boards.get("/random", async (c) => {
  const levelUuid = c.req.query("level_uuid");

  let rows;
  if (levelUuid) {
    rows = await sql`SELECT * FROM boards WHERE level_uuid = ${levelUuid} ORDER BY RANDOM() LIMIT 1`;
  } else {
    rows = await sql`SELECT * FROM boards ORDER BY RANDOM() LIMIT 1`;
  }

  if (rows.length === 0) {
    return c.json({ error: "No boards found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// GET one board by uuid (public)
boards.get("/:uuid", zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const rows = await sql`SELECT * FROM boards WHERE uuid = ${uuid}`;

  if (rows.length === 0) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// POST create board (protected)
boards.post("/", authMiddleware, zValidator("json", boardCreateSchema), async (c) => {
  const body = c.req.valid("json");

  const rows = await sql`
    INSERT INTO boards (level_uuid, symmetrical, board, solution, techniques)
    VALUES (${body.level_uuid ?? null}, ${body.symmetrical}, ${body.board}, ${body.solution}, ${body.techniques})
    RETURNING *
  `;

  return c.json({ data: rows[0] }, 201);
});

// PUT update board (protected)
boards.put("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), zValidator("json", boardUpdateSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await sql`SELECT * FROM boards WHERE uuid = ${uuid}`;
  if (existing.length === 0) {
    return c.json({ error: "Board not found" }, 404);
  }

  const current = existing[0];
  const updatedLevelUuid = body.level_uuid !== undefined ? body.level_uuid : current.level_uuid;
  const updatedSymmetrical = body.symmetrical ?? current.symmetrical;
  const updatedBoard = body.board ?? current.board;
  const updatedSolution = body.solution ?? current.solution;
  const updatedTechniques = body.techniques ?? current.techniques;

  const rows = await sql`
    UPDATE boards SET
      level_uuid = ${updatedLevelUuid},
      symmetrical = ${updatedSymmetrical},
      board = ${updatedBoard},
      solution = ${updatedSolution},
      techniques = ${updatedTechniques},
      updated_at = NOW()
    WHERE uuid = ${uuid}
    RETURNING *
  `;

  return c.json({ data: rows[0] });
});

// DELETE board (protected)
boards.delete("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");

  const rows = await sql`DELETE FROM boards WHERE uuid = ${uuid} RETURNING *`;

  if (rows.length === 0) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

export default boards;
