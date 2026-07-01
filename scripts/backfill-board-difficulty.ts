/**
 * backfill-board-difficulty.ts
 *
 * Re-validates every board through the solver /validate endpoint and updates
 * `level`, `techniques`, and the new `difficulty_score` column in one pass.
 *
 * Why all three: the deployed solver changed (rebalanced technique levels +
 * difficulty-ordered easiest-first solving), so a board's hardest technique
 * (level), the set of techniques it uses (bitfield), and the summed effort
 * (difficulty_score) can all differ from the stored values.
 *
 * REQUIRES the solver deployment that returns `difficulty_score` from
 * /api/validate (SudokuApi ValidateController). Until that is live, this script
 * will refuse to run unless --allow-zero-score is passed (see the guard below).
 *
 * Usage:
 *   bun run scripts/backfill-board-difficulty.ts [--limit N] [--dry-run]
 *                                                [--concurrency N] [--only-missing]
 *                                                [--allow-zero-score]
 *   SOLVER_URL=https://... bun run scripts/backfill-board-difficulty.ts --limit 50 --dry-run
 */

import { db, boards } from "../src/db";
import { eq, sql } from "drizzle-orm";

const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8080";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_MISSING = process.argv.includes("--only-missing"); // only rows with difficulty_score = 0
const ALLOW_ZERO_SCORE = process.argv.includes("--allow-zero-score");
const numArg = (flag: string, dflt: number): number => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : dflt;
};
const LIMIT = numArg("--limit", 0);
const CONCURRENCY = Math.max(1, numArg("--concurrency", 8));

interface ValidateResponse {
  success: boolean;
  error?: { code?: string; message?: string } | null;
  data: {
    board: { level: number; techniques: number; difficulty_score?: number };
  } | null;
}

type ValidateOk = { level: number; techniques: number; difficulty_score: number };
type ValidateResult = ValidateOk | { error: string };
const isOk = (r: ValidateResult): r is ValidateOk => "difficulty_score" in r;

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Retries transient failures (network error, HTTP 5xx) a few times. Returns a
// definitive { error } only for real problems: 4xx, a validate error (e.g. the
// puzzle is not solvable by the rule techniques), or techniques === 0.
async function validateBoard(original: string): Promise<ValidateResult> {
  const url = `${SOLVER_URL}/api/validate?original=${original}`;
  const MAX_ATTEMPTS = 4;
  let lastErr = "unknown";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastErr = `http ${response.status}`;
        if (response.status >= 500) {
          await sleep(250 * attempt);
          continue; // transient server error -> retry
        }
        return { error: lastErr }; // 4xx -> definitive
      }
      const result = (await response.json()) as ValidateResponse;
      if (!result.success || !result.data) {
        return { error: `validate ${result.error?.code ?? "no-data"}` };
      }
      const b = result.data.board;
      if (!(b.techniques > 0)) {
        return { error: "techniques=0 (not rule-solvable)" };
      }
      return {
        level: b.level,
        techniques: b.techniques,
        difficulty_score: b.difficulty_score ?? 0,
      };
    } catch (e) {
      lastErr = `fetch ${(e as Error)?.message ?? e}`;
      await sleep(250 * attempt); // transient network error -> retry
    }
  }
  return { error: lastErr };
}

async function main() {
  console.log("Backfill board difficulty_score / level / techniques");
  console.log("====================================================");
  console.log(`SOLVER_URL:   ${SOLVER_URL}`);
  console.log(`DRY_RUN:      ${DRY_RUN}`);
  console.log(`ONLY_MISSING: ${ONLY_MISSING}`);
  console.log(`CONCURRENCY:  ${CONCURRENCY}`);
  console.log(`LIMIT:        ${LIMIT || "none"}`);
  console.log();

  // Deployment guard: confirm the live solver actually returns difficulty_score
  // before rewriting 116k rows to 0. One probe against a known board.
  const probe = await db
    .select({ board: boards.board })
    .from(boards)
    .limit(1);
  if (probe.length) {
    const r = await validateBoard(probe[0].board);
    if (!isOk(r)) {
      console.error(`ABORT: probe /validate call failed (${r.error}). Is SOLVER_URL reachable?`);
      process.exit(1);
    }
    if (r.difficulty_score === 0 && !ALLOW_ZERO_SCORE) {
      console.error(
        "ABORT: solver returned difficulty_score=0. The deployment that exposes\n" +
          "difficulty_score is not live yet. Deploy it, or pass --allow-zero-score\n" +
          "to intentionally backfill only level/techniques for now."
      );
      process.exit(1);
    }
    console.log(`Probe OK: level=${r.level} techniques=${r.techniques} difficulty_score=${r.difficulty_score}\n`);
  }

  let query = db
    .select({ uuid: boards.uuid, board: boards.board })
    .from(boards);
  if (ONLY_MISSING) query = query.where(eq(boards.difficulty_score, 0)) as typeof query;
  query = query.orderBy(boards.uuid) as typeof query;
  if (LIMIT > 0) query = query.limit(LIMIT) as typeof query;

  const rows = await query;
  console.log(`Processing ${rows.length} boards\n`);
  if (rows.length === 0) {
    console.log("Nothing to do!");
    process.exit(0);
  }

  let processed = 0,
    updated = 0;
  const failures: Array<{ uuid: string; board: string; reason: string }> = [];

  // Simple fixed-size worker pool over the row list.
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const idx = cursor++;
      const rec = rows[idx];
      const r = await validateBoard(rec.board);
      processed++;
      if (isOk(r)) {
        if (!DRY_RUN) {
          await db
            .update(boards)
            .set({
              level: r.level,
              techniques: r.techniques,
              difficulty_score: r.difficulty_score,
              updated_at: new Date(),
            })
            .where(eq(boards.uuid, rec.uuid));
        }
        updated++;
      } else {
        failures.push({ uuid: rec.uuid, board: rec.board, reason: r.error });
        console.error(`  FAIL ${rec.uuid}: ${r.error}  board=${rec.board}`);
      }
      if (processed % 500 === 0 || processed === rows.length) {
        console.log(`[${processed}/${rows.length}] updated=${updated} failed=${failures.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Report the resulting distribution so the reclassification is visible.
  if (!DRY_RUN) {
    const dist = await db
      .select({ level: boards.level, n: sql<number>`count(*)::int` })
      .from(boards)
      .groupBy(boards.level)
      .orderBy(boards.level);
    console.log("\nResulting boards-per-level:");
    for (const d of dist) console.log(`  level ${d.level}: ${d.n}`);
  }

  console.log("\n====================================================");
  console.log(`Processed ${processed}, updated ${updated}, failed ${failures.length}`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} board(s) FAILED (left unchanged):`);
    for (const f of failures) console.error(`  ${f.uuid}  ${f.reason}  ${f.board}`);
    console.error("\nInvestigate these before trusting the run.");
  }
  console.log("Done!");
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
