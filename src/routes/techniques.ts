import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db";
import { techniqueCreateSchema, techniqueUpdateSchema, uuidParamSchema } from "../schemas";
import { authMiddleware } from "../middleware/auth";

const techniques = new Hono();

// GET all techniques (public)
techniques.get("/", async (c) => {
  const levelUuid = c.req.query("level_uuid");

  let rows;
  if (levelUuid) {
    rows = await sql`SELECT * FROM techniques WHERE level_uuid = ${levelUuid} ORDER BY index ASC`;
  } else {
    rows = await sql`SELECT * FROM techniques ORDER BY level_uuid, index ASC`;
  }

  return c.json({ data: rows });
});

// GET one technique by uuid (public)
techniques.get("/:uuid", zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const rows = await sql`SELECT * FROM techniques WHERE uuid = ${uuid}`;

  if (rows.length === 0) {
    return c.json({ error: "Technique not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// POST create technique (protected)
techniques.post("/", authMiddleware, zValidator("json", techniqueCreateSchema), async (c) => {
  const body = c.req.valid("json");

  const rows = await sql`
    INSERT INTO techniques (level_uuid, index, title, text)
    VALUES (${body.level_uuid}, ${body.index}, ${body.title}, ${body.text})
    RETURNING *
  `;

  return c.json({ data: rows[0] }, 201);
});

// PUT update technique (protected)
techniques.put("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), zValidator("json", techniqueUpdateSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await sql`SELECT * FROM techniques WHERE uuid = ${uuid}`;
  if (existing.length === 0) {
    return c.json({ error: "Technique not found" }, 404);
  }

  const current = existing[0];
  const updatedLevelUuid = body.level_uuid ?? current.level_uuid;
  const updatedIndex = body.index ?? current.index;
  const updatedTitle = body.title ?? current.title;
  const updatedText = body.text ?? current.text;

  const rows = await sql`
    UPDATE techniques SET
      level_uuid = ${updatedLevelUuid},
      index = ${updatedIndex},
      title = ${updatedTitle},
      text = ${updatedText},
      updated_at = NOW()
    WHERE uuid = ${uuid}
    RETURNING *
  `;

  return c.json({ data: rows[0] });
});

// DELETE technique (protected)
techniques.delete("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");

  const rows = await sql`DELETE FROM techniques WHERE uuid = ${uuid} RETURNING *`;

  if (rows.length === 0) {
    return c.json({ error: "Technique not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

export default techniques;
