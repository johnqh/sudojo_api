import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db";
import { dailyCreateSchema, dailyUpdateSchema, uuidParamSchema, dateParamSchema } from "../schemas";
import { authMiddleware } from "../middleware/auth";

const dailies = new Hono();

// GET all dailies (public)
dailies.get("/", async (c) => {
  const rows = await sql`SELECT * FROM dailies ORDER BY date DESC`;
  return c.json({ data: rows });
});

// GET random daily (public)
dailies.get("/random", async (c) => {
  const rows = await sql`SELECT * FROM dailies ORDER BY RANDOM() LIMIT 1`;

  if (rows.length === 0) {
    return c.json({ error: "No dailies found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// GET today's daily (public)
dailies.get("/today", async (c) => {
  const today = new Date().toISOString().split("T")[0] as string;
  const rows = await sql`SELECT * FROM dailies WHERE date = ${today}`;

  if (rows.length === 0) {
    return c.json({ error: "No daily puzzle for today" }, 404);
  }

  return c.json({ data: rows[0] });
});

// GET daily by date (public)
dailies.get("/date/:date", zValidator("param", dateParamSchema), async (c) => {
  const { date } = c.req.valid("param");
  const rows = await sql`SELECT * FROM dailies WHERE date = ${date}`;

  if (rows.length === 0) {
    return c.json({ error: "Daily not found for this date" }, 404);
  }

  return c.json({ data: rows[0] });
});

// GET one daily by uuid (public)
dailies.get("/:uuid", zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const rows = await sql`SELECT * FROM dailies WHERE uuid = ${uuid}`;

  if (rows.length === 0) {
    return c.json({ error: "Daily not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// POST create daily (protected)
dailies.post("/", authMiddleware, zValidator("json", dailyCreateSchema), async (c) => {
  const body = c.req.valid("json");

  const rows = await sql`
    INSERT INTO dailies (date, board_uuid, level_uuid, techniques, board, solution)
    VALUES (${body.date}, ${body.board_uuid ?? null}, ${body.level_uuid ?? null}, ${body.techniques}, ${body.board}, ${body.solution})
    RETURNING *
  `;

  return c.json({ data: rows[0] }, 201);
});

// PUT update daily (protected)
dailies.put("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), zValidator("json", dailyUpdateSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await sql`SELECT * FROM dailies WHERE uuid = ${uuid}`;
  if (existing.length === 0) {
    return c.json({ error: "Daily not found" }, 404);
  }

  const current = existing[0];
  const updatedDate = body.date ?? current.date;
  const updatedBoardUuid = body.board_uuid !== undefined ? body.board_uuid : current.board_uuid;
  const updatedLevelUuid = body.level_uuid !== undefined ? body.level_uuid : current.level_uuid;
  const updatedTechniques = body.techniques ?? current.techniques;
  const updatedBoard = body.board ?? current.board;
  const updatedSolution = body.solution ?? current.solution;

  const rows = await sql`
    UPDATE dailies SET
      date = ${updatedDate},
      board_uuid = ${updatedBoardUuid},
      level_uuid = ${updatedLevelUuid},
      techniques = ${updatedTechniques},
      board = ${updatedBoard},
      solution = ${updatedSolution},
      updated_at = NOW()
    WHERE uuid = ${uuid}
    RETURNING *
  `;

  return c.json({ data: rows[0] });
});

// DELETE daily (protected)
dailies.delete("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");

  const rows = await sql`DELETE FROM dailies WHERE uuid = ${uuid} RETURNING *`;

  if (rows.length === 0) {
    return c.json({ error: "Daily not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

export default dailies;
