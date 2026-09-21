/**
 * 2026-09-21-boards-high-bits.ts
 *
 * Repair `boards.techniques` (and `game_sessions.techniques`) rows whose bitmask
 * was corrupted by JS number rounding before the bigint migration.
 *
 * Cause: the value was held in a JS `number` and handed to postgres.js, which
 * sends it as `'' + x`. For a mask with a technique id >= 54 the double only
 * keeps 53 significant bits, so the low bits (the easy techniques) are lost and
 * the decimal digits below the double's granularity are junk:
 *   true 72057594079873102 (bits 1,2,3,6,11,23,25,56) -> stored 72057594079873100 (bit 1 lost)
 *
 * The lost bits cannot be recovered from the stored value, so each affected
 * board is re-validated against the solver, which returns the exact mask in
 * `techniques_bitmask`. Only rows where the solver's mask differs are written.
 *
 * Usage:
 *   bun run scripts/repairs/2026-09-21-boards-high-bits.ts --dry-run
 *   bun run scripts/repairs/2026-09-21-boards-high-bits.ts
 *   bun run scripts/repairs/2026-09-21-boards-high-bits.ts --sample 200   # audit exact rows too
 *
 * Re-runnable: it re-derives the truth each time and is a no-op once repaired.
 * The pre-repair values are written to scripts/repairs/<date>-boards-high-bits.backup.json
 * (and a matching .rollback.sql) before any UPDATE.
 */

import { db, boards, gameSessions } from "../../src/db";
import { eq, sql as raw } from "drizzle-orm";
import { solverBitmask, bitmaskParam } from "../../src/lib/bitmask";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8080";
const DRY_RUN = process.argv.includes("--dry-run");
const SAMPLE = (() => {
  const i = process.argv.indexOf("--sample");
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 0;
})();

/** Values above this are the only ones a JS number could have corrupted. */
const TWO53 = 2n ** 53n;
const CONCURRENCY = 4;

interface ValidateResponse {
  success: boolean;
  error: { code: number; message: string } | null;
  data: {
    board: {
      level: number;
      difficulty_score?: number;
      techniques: number;
      techniques_bitmask?: string;
    };
  } | null;
}

async function solve(original: string) {
  const res = await fetch(`${SOLVER_URL}/api/validate?original=${original}`);
  if (!res.ok) throw new Error(`solver ${res.status}`);
  const json = (await res.json()) as ValidateResponse;
  if (!json.success || !json.data) {
    throw new Error(`solver rejected board: ${json.error?.message ?? "unknown"}`);
  }
  if (json.data.board.techniques_bitmask == null) {
    // Without the exact string the solver's number is already rounded; refuse
    // to write a value we cannot trust.
    throw new Error("solver predates techniques_bitmask; aborting (would rewrite lossy values)");
  }
  return {
    techniques: solverBitmask(json.data.board),
    level: json.data.board.level,
    difficultyScore: json.data.board.difficulty_score,
  };
}

/** Run `fn` over `items` with bounded concurrency, in order-independent fashion. */
async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

interface Row {
  uuid: string;
  board: string;
  techniques: bigint | null;
  level: number | null;
}

type Outcome =
  | { kind: "repair"; row: Row; solver: bigint; lost: number[]; spurious: number[] }
  | { kind: "match"; row: Row }
  | { kind: "error"; row: Row; error: string };

function bitsOf(v: bigint): number[] {
  const out: number[] = [];
  for (let i = 0n; i <= 63n; i++) if ((v >> i) & 1n) out.push(Number(i));
  return out;
}

async function check(row: Row): Promise<Outcome> {
  try {
    const { techniques } = await solve(row.board);
    const stored = row.techniques ?? 0n;
    if (techniques === stored) return { kind: "match", row };
    const s = new Set(bitsOf(stored));
    const t = new Set(bitsOf(techniques));
    return {
      kind: "repair",
      row,
      solver: techniques,
      lost: [...t].filter(b => !s.has(b)),
      spurious: [...s].filter(b => !t.has(b)),
    };
  } catch (error) {
    return { kind: "error", row, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  console.log("Repair boards.techniques high bits");
  console.log("==================================");
  console.log(`SOLVER_URL: ${SOLVER_URL}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log();

  const suspect = (await db
    .select({ uuid: boards.uuid, board: boards.board, techniques: boards.techniques, level: boards.level })
    .from(boards)
    .where(raw`${boards.techniques} > ${bitmaskParam(TWO53)}`)
    .orderBy(boards.techniques)) as Row[];

  console.log(`boards with techniques > 2^53: ${suspect.length}`);

  const results = await pool(suspect, CONCURRENCY, check);
  const repairs = results.filter(r => r.kind === "repair") as Extract<Outcome, { kind: "repair" }>[];
  const errors = results.filter(r => r.kind === "error") as Extract<Outcome, { kind: "error" }>[];

  for (const r of repairs) {
    console.log(
      `  ${r.row.uuid}  ${r.row.techniques} -> ${r.solver}` +
        `  lost=[${r.lost.join(",")}]${r.spurious.length ? ` spurious=[${r.spurious.join(",")}]` : ""}`
    );
  }
  for (const e of errors) console.log(`  ERROR ${e.row.uuid}: ${e.error}`);
  console.log(
    `\nmatch=${results.filter(r => r.kind === "match").length} repair=${repairs.length} error=${errors.length}`
  );

  // Audit: rows at or below 2^53 are exactly representable, so they should
  // already agree with the solver. Sample a few to prove no other pollution.
  if (SAMPLE > 0) {
    const exactRows = (await db
      .select({ uuid: boards.uuid, board: boards.board, techniques: boards.techniques, level: boards.level })
      .from(boards)
      .where(raw`${boards.techniques} <= ${bitmaskParam(TWO53)}`)
      .orderBy(raw`random()`)
      .limit(SAMPLE)) as Row[];
    const sampled = await pool(exactRows, CONCURRENCY, check);
    const bad = sampled.filter(r => r.kind !== "match");
    console.log(`\nsample of ${exactRows.length} rows <= 2^53: mismatches=${bad.length}`);
    for (const b of bad) {
      if (b.kind === "repair") {
        console.log(`  MISMATCH ${b.row.uuid} ${b.row.techniques} -> ${b.solver} lost=[${b.lost.join(",")}] spurious=[${b.spurious.join(",")}]`);
      } else if (b.kind === "error") {
        console.log(`  ERROR ${b.row.uuid}: ${b.error}`);
      }
    }
  }

  // game_sessions carries a copy of the board's mask.
  const sessions = await db
    .select({ id: gameSessions.id, board: gameSessions.board, techniques: gameSessions.techniques })
    .from(gameSessions)
    .where(raw`${gameSessions.techniques} > ${bitmaskParam(TWO53)}`);
  const sessionFixes: Array<{ id: string; old: string; next: bigint }> = [];
  for (const s of sessions) {
    const { techniques } = await solve(s.board);
    if (techniques !== (s.techniques ?? 0n)) {
      sessionFixes.push({ id: s.id, old: String(s.techniques), next: techniques });
      console.log(`\ngame_sessions ${s.id}: ${s.techniques} -> ${techniques}`);
    }
  }
  console.log(`game_sessions with techniques > 2^53: ${sessions.length}, to repair: ${sessionFixes.length}`);

  if (!repairs.length && !sessionFixes.length) {
    console.log("\nNothing to write.");
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const dir = import.meta.dir;
  writeFileSync(
    join(dir, `${stamp}-boards-high-bits.backup.json`),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        boards: repairs.map(r => ({ uuid: r.row.uuid, old: String(r.row.techniques), new: String(r.solver), lost: r.lost, spurious: r.spurious })),
        game_sessions: sessionFixes.map(s => ({ id: s.id, old: s.old, new: String(s.next) })),
      },
      null,
      2
    )
  );
  const rollback = [
    "-- Rollback for 2026-09-21-boards-high-bits.ts: restores the exact pre-repair values.",
    "BEGIN;",
    ...repairs.map(
      r => `UPDATE boards SET techniques = ${r.row.techniques}::bigint WHERE uuid = '${r.row.uuid}';`
    ),
    ...sessionFixes.map(s => `UPDATE game_sessions SET techniques = ${s.old}::bigint WHERE id = '${s.id}';`),
    "COMMIT;",
    "",
  ].join("\n");
  writeFileSync(join(dir, `${stamp}-boards-high-bits.rollback.sql`), rollback);
  console.log(`\nWrote backup + rollback to ${dir}`);

  if (DRY_RUN) {
    console.log("DRY RUN: no rows written.");
    return;
  }
  if (errors.length) {
    console.log("Refusing to write: some boards could not be validated. Fix those first.");
    process.exitCode = 1;
    return;
  }

  await db.transaction(async tx => {
    for (const r of repairs) {
      await tx
        .update(boards)
        .set({ techniques: r.solver, updated_at: new Date() })
        .where(eq(boards.uuid, r.row.uuid));
    }
    for (const s of sessionFixes) {
      await tx.update(gameSessions).set({ techniques: s.next }).where(eq(gameSessions.id, s.id));
    }
  });
  console.log(`Wrote ${repairs.length} boards, ${sessionFixes.length} game_sessions.`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });
