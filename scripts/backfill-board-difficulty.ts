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
  data: {
    board: { level: number; techniques: number; difficulty_score?: number };
  } | null;
}

async function validateBoard(
  original: string
): Promise<{ level: number; techniques: number; difficulty_score: number } | null> {
  try {
    const response = await fetch(`${SOLVER_URL}/api/validate?original=${original}`);
    if (!response.ok) return null;
    const result = (await response.json()) as ValidateResponse;
    if (!result.success || !result.data) return null;
    return {
      level: result.data.board.level,
      techniques: result.data.board.techniques,
      difficulty_score: result.data.board.difficulty_score ?? 0,
    };
  } catch {
    return null;
  }
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
    if (!r) {
      console.error("ABORT: probe /validate call failed. Is SOLVER_URL reachable?");
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
    updated = 0,
    failed = 0,
    levelChanged = 0;

  // Simple fixed-size worker pool over the row list.
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const idx = cursor++;
      const rec = rows[idx];
      const r = await validateBoard(rec.board);
      processed++;
      if (r && r.techniques > 0) {
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
        failed++;
      }
      if (processed % 500 === 0 || processed === rows.length) {
        console.log(`[${processed}/${rows.length}] updated=${updated} failed=${failed}`);
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
  console.log(`Processed ${processed}, updated ${updated}, failed ${failed}`);
  console.log("Done!");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
