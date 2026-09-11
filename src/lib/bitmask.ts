/**
 * @fileoverview Technique bitmasks: parsing, SQL binding, JSON output.
 *
 * A technique bitmask sets bit N for technique id N (1-60). Once any id >= 54
 * is set the value exceeds 2^53, so a JS number silently drops the low bits
 * (the easy techniques). Inside the API a bitmask is therefore always a
 * `bigint`: Drizzle bitmask columns use `mode: "bigint"`, request fields and
 * query params are parsed with {@link parseBitmask}, and SQL params go through
 * {@link bitmaskParam}.
 *
 * `JSON.stringify` (and so Hono's `c.json`) throws on a `bigint`, and old app
 * builds read `techniques` as a number. Every response therefore goes through
 * {@link toBitmaskFields}: it keeps the numeric field (as lossy as it has
 * always been) and adds an exact decimal-string companion `<field>_bitmask`.
 * Clients should read the companion and parse it with `BigInt(...)`.
 */

import { sql, type SQL } from "drizzle-orm";
import type {
  Board,
  Daily,
  TechniqueExample,
  ValidateBoardData,
} from "@sudobility/sudojo_types";

/** Largest value a Postgres BIGINT (signed 64-bit) can hold. */
export const BITMASK_MAX = 2n ** 63n - 1n;

/** Response fields that carry a technique bitmask. */
export const BITMASK_FIELDS = ["techniques", "techniques_bitfield"] as const;
export type BitmaskField = (typeof BITMASK_FIELDS)[number];

/**
 * Parse a technique bitmask from a request.
 *
 * Accepts a non-negative integer `number`, a base-10 digit string, or a
 * `bigint`, up to {@link BITMASK_MAX}. Returns `null` for anything else
 * (negative, fractional, exponent/hex/padded strings, "", null, ...), so each
 * caller reports the error in its own style.
 */
export function parseBitmask(value: unknown): bigint | null {
  let parsed: bigint;
  if (typeof value === "bigint") {
    parsed = value;
  } else if (typeof value === "number") {
    if (!Number.isInteger(value)) return null;
    parsed = BigInt(value);
  } else if (typeof value === "string") {
    if (!/^[0-9]+$/.test(value)) return null;
    parsed = BigInt(value);
  } else {
    return null;
  }
  return parsed >= 0n && parsed <= BITMASK_MAX ? parsed : null;
}

/** The bitmask bit for a technique id: `1n << id`, exact for every id. */
export function techniqueBit(techniqueId: number): bigint {
  return 1n << BigInt(techniqueId);
}

/**
 * Bind a bitmask into raw SQL as a decimal string cast to bigint, e.g.
 * sql`(${boards.techniques} & ${bitmaskParam(bit)}) != 0`.
 *
 * Never interpolate a JS number here: postgres.js sends it as `'' + x`, and
 * `String(2 ** 60)` is "1152921504606847000" -- not bit 60.
 */
export function bitmaskParam(value: bigint): SQL {
  return sql`${value.toString()}::bigint`;
}

/**
 * The solver's /validate and /generate `data.board` bitmask.
 *
 * The solver sends the ulong twice: `techniques` (a JSON number, already
 * rounded by `JSON.parse`) and `techniques_bitmask` (the same value as a
 * decimal string). Prefer the string; fall back to `String(techniques)` for a
 * solver that predates it.
 *
 * @throws Error if neither field holds a valid bitmask
 */
export function solverBitmask(board: {
  techniques?: number | null;
  techniques_bitmask?: string | null;
}): bigint {
  if (board.techniques_bitmask != null) {
    const exact = parseBitmask(board.techniques_bitmask);
    if (exact !== null) return exact;
    console.warn(
      `[bitmask] solver sent invalid techniques_bitmask ${JSON.stringify(board.techniques_bitmask)}; using techniques`
    );
  }
  const fallback =
    typeof board.techniques === "number"
      ? parseBitmask(String(board.techniques))
      : null;
  if (fallback === null) {
    throw new Error(
      `Solver returned no valid techniques bitmask (techniques=${String(board.techniques)})`
    );
  }
  return fallback;
}

/**
 * The solver's /validate or /generate `data` as the API returns it: the board
 * bitmask read with {@link solverBitmask}, then split into `techniques`
 * (number) and `techniques_bitmask` (exact string).
 *
 * @throws Error if the solver sent no valid bitmask
 */
export function toValidateResponseData<
  D extends {
    board: ValidateBoardData & { techniques_bitmask?: string | null };
  },
>(data: D): Omit<D, "board"> & ValidateResponseData {
  // toBitmaskFields overwrites the solver's techniques_bitmask with the value
  // actually used, so the response is consistent whichever field won.
  return {
    ...data,
    board: toBitmaskFields({
      ...data.board,
      techniques: solverBitmask(data.board),
    }),
  };
}

type NumberFor<V> = V extends bigint ? number : V;
type StringFor<V> = V extends bigint ? string : V;

/**
 * `T` as it goes out in a response: each bitmask field becomes a number and
 * gains a `<field>_bitmask` string (null stays null in both).
 */
export type WithBitmaskFields<T> = {
  [K in keyof T]: K extends BitmaskField ? NumberFor<T[K]> : T[K];
} & {
  [K in keyof T & BitmaskField as `${K}_bitmask`]: StringFor<T[K]>;
};

/**
 * Convert a row (or any object) for a JSON response. For every bitmask field
 * present: `field` -> `Number(value)` (kept for old clients; lossy above
 * 2^53), plus `field_bitmask` -> the exact decimal string. Other fields are
 * copied unchanged. Accepts the field as a bigint, number, or decimal string.
 *
 * @throws Error if a bitmask field holds something that is not a bitmask
 */
export function toBitmaskFields<T extends object>(
  row: T
): WithBitmaskFields<T> {
  const input = row as Record<string, unknown>;
  const out: Record<string, unknown> = { ...input };
  for (const field of BITMASK_FIELDS) {
    if (!(field in input)) continue;
    const value = input[field];
    if (value === null || value === undefined) {
      out[field] = value;
      out[`${field}_bitmask`] = value;
      continue;
    }
    const bitmask = parseBitmask(value);
    if (bitmask === null) {
      throw new Error(`Invalid ${field} bitmask: ${String(value)}`);
    }
    out[field] = Number(bitmask);
    out[`${field}_bitmask`] = bitmask.toString();
  }
  return out as WithBitmaskFields<T>;
}

// =============================================================================
// Response types
// =============================================================================
// TODO(sudojo_types): @sudobility/sudojo_types ^1.2.67 does not have the
// `_bitmask` companions yet. Another change is adding `techniques_bitmask?:
// string` there. Once a version with them is published and this repo depends
// on it, replace these intersections with the package types.

/** GET/POST/PUT/DELETE /boards* item. */
export type BoardResponse = Board & { techniques_bitmask: string | null };

/** /dailies* item, including the unpersisted fallback daily. */
export type DailyResponse = Daily & { techniques_bitmask: string | null };

/** /examples* item. */
export type TechniqueExampleResponse = TechniqueExample & {
  techniques_bitfield_bitmask: string;
};

/** `data.board` of /solver/validate and /solver/generate. */
export type ValidateBoardResponse = ValidateBoardData & {
  techniques_bitmask: string;
};

/** `data` of /solver/validate and /solver/generate. */
export interface ValidateResponseData {
  board: ValidateBoardResponse;
}
