import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db";
import { challengeCreateSchema, challengeUpdateSchema, uuidParamSchema } from "../schemas";
import { authMiddleware } from "../middleware/auth";

const challenges = new Hono();

// GET all challenges (public)
challenges.get("/", async (c) => {
  const levelUuid = c.req.query("level_uuid");
  const difficulty = c.req.query("difficulty");

  let rows;
  if (levelUuid && difficulty) {
    rows = await sql`
      SELECT * FROM challenges
      WHERE level_uuid = ${levelUuid} AND difficulty = ${parseInt(difficulty)}
      ORDER BY difficulty ASC
    `;
  } else if (levelUuid) {
    rows = await sql`SELECT * FROM challenges WHERE level_uuid = ${levelUuid} ORDER BY difficulty ASC`;
  } else if (difficulty) {
    rows = await sql`SELECT * FROM challenges WHERE difficulty = ${parseInt(difficulty)} ORDER BY created_at DESC`;
  } else {
    rows = await sql`SELECT * FROM challenges ORDER BY difficulty ASC, created_at DESC`;
  }

  return c.json({ data: rows });
});

// GET random challenge (public)
challenges.get("/random", async (c) => {
  const levelUuid = c.req.query("level_uuid");
  const difficulty = c.req.query("difficulty");

  let rows;
  if (levelUuid && difficulty) {
    rows = await sql`
      SELECT * FROM challenges
      WHERE level_uuid = ${levelUuid} AND difficulty = ${parseInt(difficulty)}
      ORDER BY RANDOM() LIMIT 1
    `;
  } else if (levelUuid) {
    rows = await sql`SELECT * FROM challenges WHERE level_uuid = ${levelUuid} ORDER BY RANDOM() LIMIT 1`;
  } else if (difficulty) {
    rows = await sql`SELECT * FROM challenges WHERE difficulty = ${parseInt(difficulty)} ORDER BY RANDOM() LIMIT 1`;
  } else {
    rows = await sql`SELECT * FROM challenges ORDER BY RANDOM() LIMIT 1`;
  }

  if (rows.length === 0) {
    return c.json({ error: "No challenges found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// GET one challenge by uuid (public)
challenges.get("/:uuid", zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const rows = await sql`SELECT * FROM challenges WHERE uuid = ${uuid}`;

  if (rows.length === 0) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// POST create challenge (protected)
challenges.post("/", authMiddleware, zValidator("json", challengeCreateSchema), async (c) => {
  const body = c.req.valid("json");

  const rows = await sql`
    INSERT INTO challenges (board_uuid, level_uuid, difficulty, board, solution)
    VALUES (${body.board_uuid ?? null}, ${body.level_uuid ?? null}, ${body.difficulty}, ${body.board}, ${body.solution})
    RETURNING *
  `;

  return c.json({ data: rows[0] }, 201);
});

// PUT update challenge (protected)
challenges.put("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), zValidator("json", challengeUpdateSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await sql`SELECT * FROM challenges WHERE uuid = ${uuid}`;
  if (existing.length === 0) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  const current = existing[0];
  const updatedBoardUuid = body.board_uuid !== undefined ? body.board_uuid : current.board_uuid;
  const updatedLevelUuid = body.level_uuid !== undefined ? body.level_uuid : current.level_uuid;
  const updatedDifficulty = body.difficulty ?? current.difficulty;
  const updatedBoard = body.board ?? current.board;
  const updatedSolution = body.solution ?? current.solution;

  const rows = await sql`
    UPDATE challenges SET
      board_uuid = ${updatedBoardUuid},
      level_uuid = ${updatedLevelUuid},
      difficulty = ${updatedDifficulty},
      board = ${updatedBoard},
      solution = ${updatedSolution},
      updated_at = NOW()
    WHERE uuid = ${uuid}
    RETURNING *
  `;

  return c.json({ data: rows[0] });
});

// DELETE challenge (protected)
challenges.delete("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");

  const rows = await sql`DELETE FROM challenges WHERE uuid = ${uuid} RETURNING *`;

  if (rows.length === 0) {
    return c.json({ error: "Challenge not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

export default challenges;
