import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "../db";
import { levelCreateSchema, levelUpdateSchema, uuidParamSchema } from "../schemas";
import { authMiddleware } from "../middleware/auth";

const levels = new Hono();

// GET all levels (public)
levels.get("/", async (c) => {
  const rows = await sql`SELECT * FROM levels ORDER BY index ASC`;
  return c.json({ data: rows });
});

// GET one level by uuid (public)
levels.get("/:uuid", zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const rows = await sql`SELECT * FROM levels WHERE uuid = ${uuid}`;

  if (rows.length === 0) {
    return c.json({ error: "Level not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

// POST create level (protected)
levels.post("/", authMiddleware, zValidator("json", levelCreateSchema), async (c) => {
  const body = c.req.valid("json");

  const rows = await sql`
    INSERT INTO levels (index, title, text, requires_subscription)
    VALUES (${body.index}, ${body.title}, ${body.text}, ${body.requires_subscription})
    RETURNING *
  `;

  return c.json({ data: rows[0] }, 201);
});

// PUT update level (protected)
levels.put("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), zValidator("json", levelUpdateSchema), async (c) => {
  const { uuid } = c.req.valid("param");
  const body = c.req.valid("json");

  // Check if level exists
  const existing = await sql`SELECT * FROM levels WHERE uuid = ${uuid}`;
  if (existing.length === 0) {
    return c.json({ error: "Level not found" }, 404);
  }

  const current = existing[0];
  const updatedIndex = body.index ?? current.index;
  const updatedTitle = body.title ?? current.title;
  const updatedText = body.text ?? current.text;
  const updatedRequiresSubscription = body.requires_subscription ?? current.requires_subscription;

  const rows = await sql`
    UPDATE levels SET
      index = ${updatedIndex},
      title = ${updatedTitle},
      text = ${updatedText},
      requires_subscription = ${updatedRequiresSubscription},
      updated_at = NOW()
    WHERE uuid = ${uuid}
    RETURNING *
  `;

  return c.json({ data: rows[0] });
});

// DELETE level (protected)
levels.delete("/:uuid", authMiddleware, zValidator("param", uuidParamSchema), async (c) => {
  const { uuid } = c.req.valid("param");

  const rows = await sql`DELETE FROM levels WHERE uuid = ${uuid} RETURNING *`;

  if (rows.length === 0) {
    return c.json({ error: "Level not found" }, 404);
  }

  return c.json({ data: rows[0] });
});

export default levels;
