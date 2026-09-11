/**
 * GET /boards (and GET /examples?has_technique) query building, checked
 * without a database.
 *
 * The routes run against a real Drizzle instance whose postgres.js client is
 * the stub in tests/unit/fake-postgres.ts: every query is recorded as the SQL
 * text and params Drizzle would have sent. That tests the SQL the handler
 * actually builds, not a hand-written imitation of it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakePostgres as pg } from "./fake-postgres";

vi.mock("../../src/db", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/db")>();
  const { fakePostgres } = await import("./fake-postgres");
  return { ...actual, db: fakePostgres.db };
});

// The real middleware imports services/firebase, which needs Firebase
// credentials at import time. These GETs are public, so it is never invoked.
vi.mock("../../src/middleware/auth", () => ({
  adminMiddleware: vi.fn(),
}));

const { default: boardsRouter } = await import("../../src/routes/boards");
const { default: examplesRouter } = await import("../../src/routes/examples");

/** Bit 60 (Grouped X-Cycles) + bit 1 (Full House). */
const HIGH_STRING = "1152921504606846978";

/** Run a GET and return the WHERE clause and params of its one query. */
async function runQuery(router: typeof boardsRouter, search: string) {
  pg.executed.length = 0;
  const res = await router.request(`/${search}`);
  expect(res.status).toBe(200);
  expect(pg.executed).toHaveLength(1);
  const { query, params } = pg.executed[0]!;
  const where = /\bwhere\b(.*?)(?:\border by\b|$)/i.exec(query)?.[1]?.trim();
  return { query, where, params };
}

const listBoards = (search: string) => runQuery(boardsRouter, search);

describe("GET /boards filters", () => {
  beforeEach(() => {
    pg.reset();
  });

  it("applies no WHERE clause without filters", async () => {
    const { query } = await listBoards("");
    expect(query).not.toMatch(/\bwhere\b/i);
  });

  it("applies a single level filter", async () => {
    const { where, params } = await listBoards("?level=3");
    expect(where).toBe('"boards"."level" = $1');
    expect(params).toEqual([3]);
  });

  it("ANDs level and technique_bit", async () => {
    const { where, params } = await listBoards("?level=3&technique_bit=4");
    expect(where).toContain('"boards"."level" = $1');
    expect(where).toContain('("boards"."techniques" & $2::bigint) != 0');
    expect(where).toMatch(/ and /);
    expect(params).toEqual([3, "4"]);
  });

  it("ANDs level and an exact techniques value", async () => {
    const { where, params } = await listBoards("?level=5&techniques=12");
    expect(where).toContain('"boards"."level" = $1');
    expect(where).toContain('"boards"."techniques" = $2::bigint');
    expect(where).toMatch(/ and /);
    expect(params).toEqual([5, "12"]);
  });

  it("keeps techniques=0 (0 or NULL) grouped when combined", async () => {
    const { where, params } = await listBoards("?level=3&techniques=0");
    expect(where).toContain('"boards"."level" = $1');
    // Without the parentheses, `level = 3 and techniques = 0 OR techniques IS
    // NULL` would return every NULL-techniques board regardless of level.
    expect(where).toContain(
      '("boards"."techniques" = 0 OR "boards"."techniques" IS NULL)'
    );
    expect(params).toEqual([3]);
  });

  it("ANDs all three filters", async () => {
    const { where, params } = await listBoards(
      "?level=7&technique_bit=8&techniques=24"
    );
    expect(where).toContain('"boards"."level" = $1');
    expect(where).toContain('("boards"."techniques" & $2::bigint) != 0');
    expect(where).toContain('"boards"."techniques" = $3::bigint');
    expect(where?.match(/ and /g)).toHaveLength(2);
    expect(params).toEqual([7, "8", "24"]);
  });

  it("binds bitmasks above 2^53 exactly, as decimal strings", async () => {
    const { params } = await listBoards(
      `?technique_bit=1152921504606846976&techniques=${HIGH_STRING}`
    );
    // A JS number would have been sent as "1152921504606847000".
    expect(params).toEqual(["1152921504606846976", HIGH_STRING]);
  });

  it("ignores an unparseable level but keeps valid filters", async () => {
    const { where, params } = await listBoards("?level=abc&technique_bit=4");
    expect(where).toBe('("boards"."techniques" & $1::bigint) != 0');
    expect(params).toEqual(["4"]);
  });

  it.each([
    "?techniques=abc",
    "?techniques=-1",
    "?techniques=1.5",
    "?technique_bit=-4",
    "?technique_bit=0x10",
  ])("rejects %s with 400 and runs no query", async search => {
    pg.executed.length = 0;
    const res = await boardsRouter.request(`/${search}`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
    expect(pg.executed).toHaveLength(0);
  });

  it("ignores technique_bit=0 and an empty techniques=, as before", async () => {
    const { query } = await listBoards("?technique_bit=0&techniques=");
    expect(query).not.toMatch(/\bwhere\b/i);
  });

  it("still orders and paginates", async () => {
    const { query, params } = await listBoards("?level=2&limit=10&offset=20");
    expect(query).toMatch(/order by "boards"."created_at" desc/i);
    expect(params).toEqual([2, 10, 20]);
  });
});

describe("GET /examples?has_technique", () => {
  beforeEach(() => {
    pg.reset();
  });

  it("binds the technique bit exactly for ids above 53", async () => {
    const { where, params } = await runQuery(
      examplesRouter,
      "?has_technique=60"
    );
    expect(where).toBe(
      '("technique_examples"."techniques_bitfield" & $1::bigint) != 0'
    );
    // techniqueToBit(60) is a JS number, which postgres.js would have sent
    // as "1152921504606847000" -- not bit 60.
    expect(params).toEqual(["1152921504606846976"]);
  });
});
