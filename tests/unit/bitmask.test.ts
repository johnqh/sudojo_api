/**
 * src/lib/bitmask.ts: the single place technique bitmasks are parsed, bound
 * into SQL, and turned into JSON-safe response fields.
 */
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  BITMASK_MAX,
  bitmaskParam,
  parseBitmask,
  solverBitmask,
  techniqueBit,
  toBitmaskFields,
} from "../../src/lib/bitmask";

/** Bit 60 (Grouped X-Cycles) + bit 1 (Full House). Needs 61 bits. */
const HIGH = (1n << 60n) | (1n << 1n);
const HIGH_STRING = "1152921504606846978";

describe("parseBitmask", () => {
  it("accepts non-negative safe integers as numbers", () => {
    expect(parseBitmask(0)).toBe(0n);
    expect(parseBitmask(42)).toBe(42n);
  });

  it("still accepts integer numbers above 2^53 from old clients", () => {
    // Already rounded by the client's JSON encoder; kept as lossy as before.
    expect(parseBitmask(2 ** 60)).toBe(1n << 60n);
  });

  it("accepts decimal strings exactly, beyond 2^53", () => {
    expect(HIGH.toString()).toBe(HIGH_STRING);
    expect(parseBitmask(HIGH_STRING)).toBe(HIGH);
    expect(parseBitmask("0")).toBe(0n);
  });

  it("accepts bigints", () => {
    expect(parseBitmask(HIGH)).toBe(HIGH);
  });

  it("accepts the largest value a Postgres BIGINT holds", () => {
    expect(BITMASK_MAX).toBe(2n ** 63n - 1n);
    expect(parseBitmask(BITMASK_MAX.toString())).toBe(BITMASK_MAX);
  });

  it.each([
    ["negative number", -1],
    ["fractional number", 1.5],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["negative string", "-1"],
    ["fractional string", "1.5"],
    ["exponent string", "1e3"],
    ["hex string", "0x10"],
    ["empty string", ""],
    ["padded string", " 12"],
    ["word", "abc"],
    ["negative bigint", -1n],
    ["above BIGINT max", (2n ** 63n).toString()],
    ["null", null],
    ["undefined", undefined],
    ["boolean", true],
    ["object", {}],
  ])("rejects %s", (_label, value) => {
    expect(parseBitmask(value)).toBeNull();
  });
});

describe("techniqueBit", () => {
  it("is exact for every technique id, including 54-60", () => {
    expect(techniqueBit(1)).toBe(2n);
    expect(techniqueBit(60)).toBe(1n << 60n);
    expect(techniqueBit(60).toString()).toBe("1152921504606846976");
  });
});

describe("bitmaskParam", () => {
  it("binds the value as a decimal string cast to bigint", () => {
    const query = new PgDialect().sqlToQuery(
      sql`(x & ${bitmaskParam(HIGH)}) != 0`
    );
    expect(query.sql).toBe("(x & $1::bigint) != 0");
    expect(query.params).toEqual([HIGH_STRING]);
    expect(typeof query.params[0]).toBe("string");
  });
});

describe("toBitmaskFields", () => {
  it("keeps the numeric field and adds an exact <field>_bitmask string", () => {
    const out = toBitmaskFields({ uuid: "u", techniques: HIGH, level: 12 });
    expect(out).toEqual({
      uuid: "u",
      level: 12,
      techniques: Number(HIGH),
      techniques_bitmask: HIGH_STRING,
    });
    // The numeric field stays exactly as lossy as it always was.
    expect(out.techniques).toBe(1152921504606846976);
  });

  it("handles techniques_bitfield", () => {
    const out = toBitmaskFields({ techniques_bitfield: HIGH });
    expect(out).toEqual({
      techniques_bitfield: Number(HIGH),
      techniques_bitfield_bitmask: HIGH_STRING,
    });
  });

  it("passes null through to both fields", () => {
    expect(toBitmaskFields({ techniques: null })).toEqual({
      techniques: null,
      techniques_bitmask: null,
    });
  });

  it("leaves objects without bitmask fields unchanged", () => {
    expect(toBitmaskFields({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
  });

  it("never returns a bigint", () => {
    const out = toBitmaskFields({ techniques: HIGH, techniques_bitfield: 3n });
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});

describe("solverBitmask", () => {
  it("prefers techniques_bitmask over the lossy number", () => {
    // What JSON.parse makes of the solver's `"techniques":1152921504606846978`.
    const lossy = JSON.parse(`{"t":${HIGH_STRING}}`).t as number;
    expect(BigInt(lossy)).not.toBe(HIGH);
    expect(
      solverBitmask({ techniques: lossy, techniques_bitmask: HIGH_STRING })
    ).toBe(HIGH);
  });

  it("falls back to String(techniques) when techniques_bitmask is absent", () => {
    expect(solverBitmask({ techniques: 42 })).toBe(42n);
    expect(solverBitmask({ techniques: 42, techniques_bitmask: null })).toBe(
      42n
    );
  });

  it("falls back when techniques_bitmask is malformed", () => {
    expect(solverBitmask({ techniques: 42, techniques_bitmask: "x" })).toBe(
      42n
    );
  });

  it("throws when neither field holds a bitmask", () => {
    expect(() => solverBitmask({})).toThrow(/techniques/);
    expect(() => solverBitmask({ techniques: -1 })).toThrow(/techniques/);
  });
});
