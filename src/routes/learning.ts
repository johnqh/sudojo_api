import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db";
import { learningCreateSchema, learningUpdateSchema, uuidParamSchema } from "../schemas";
import { authMiddleware } from "../middleware/auth";

const learning = new Hono();

// GET all learning entries (public)
learning.get("/", async (c) => {
  const techniqueUuid = c.req.query("technique_uuid");
  const languageCode = c.req.query("language_code");

  let rows;
  if (techniqueUuid && languageCode) {
    rows = await sql`
      SELECT * FROM learning
      WHERE technique_uuid = ${techniqueUuid} AND language_code = ${languageCode}
      ORDER BY index ASC
    `;
  } else if (techniqueUuid) {
    rows = await sql`
      SELECT * FROM learning
      WHERE technique_uuid = ${techniqueUuid}
      ORDER BY index ASC
    `;
  } else if (languageCode) {
    rows = await sql`
      SELECT * FROM learning
      WHERE language_code = ${languageCode}
      ORDER BY technique_uuid, index ASC
    `;
  } else {
    rows = await sql`SELECT * FROM learning ORDER BY technique_uuid, index ASC`;
  }

  return c.json({ data: rows });
});

// GET one learning entry by uuid (public)
learning.get("/:uuid", zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const rows = await sql`SELECT * FROM learning WHERE uuid = ${uuid}`;

  if (rows.length === 0) {
    return c.json({ error: "Learning entry not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// POST create learning entry (protected)
learning.post("/", authMiddleware, zValidator("json", learningCreateSchema), async (c) => {
  const body = c.req.valid("json");

  const rows = await sql`
    INSERT INTO learning (technique_uuid, index, language_code, text, image_url)
    VALUES (${body.technique_uuid}, ${body.index}, ${body.language_code}, ${body.text}, ${body.image_url ?? null})
    RETURNING *
  `;

  return c.json({ data: rows[0] }, 201);
});

// PUT update learning entry (protected)
learning.put("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), zValidator("json", learningUpdateSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const body = c.req.valid("json");

  const existing = await sql`SELECT * FROM learning WHERE uuid = ${uuid}`;
  if (existing.length === 0) {
    return c.json({ error: "Learning entry not found" }, 404);
  }

  const current = existing[0];
  const updatedTechniqueUuid = body.technique_uuid ?? current.technique_uuid;
  const updatedIndex = body.index ?? current.index;
  const updatedLanguageCode = body.language_code ?? current.language_code;
  const updatedText = body.text ?? current.text;
  const updatedImageUrl = body.image_url !== undefined ? body.image_url : current.image_url;

  const rows = await sql`
    UPDATE learning SET
      technique_uuid = ${updatedTechniqueUuid},
      index = ${updatedIndex},
      language_code = ${updatedLanguageCode},
      text = ${updatedText},
      image_url = ${updatedImageUrl},
      updated_at = NOW()
    WHERE uuid = ${uuid}
    RETURNING *
  `;

  return c.json({ data: rows[0] });
});

// DELETE learning entry (protected)
learning.delete("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");

  const rows = await sql`DELETE FROM learning WHERE uuid = ${uuid} RETURNING *`;

  if (rows.length === 0) {
    return c.json({ error: "Learning entry not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

export default learning;
