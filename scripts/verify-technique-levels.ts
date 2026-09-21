/**
 * verify-technique-levels.ts
 *
 * Checks the `techniques.level` column against src/lib/levels.ts, which is the
 * single source of truth for the 1-12 scale. The column is a denormalised copy:
 * the apps read it to group the technique library by level, so it has to agree
 * with the map the API serves levels from.
 *
 * Usage:
 *   bun run scripts/verify-technique-levels.ts           # report drift, exit 1 if any
 *   bun run scripts/verify-technique-levels.ts --fix     # rewrite the column from the map
 *
 * After `--fix`, board levels are still stale — a technique moving level changes
 * every board whose hardest technique it is. Follow with:
 *   bun run scripts/backfill-board-difficulty.ts
 */

import { db, techniques as techniquesTable } from "../src/db";
import { eq } from "drizzle-orm";
import {
  TECHNIQUE_LEVELS,
  MAX_TECHNIQUE_ID,
  levelForTechnique,
} from "../src/lib/levels";

const FIX = process.argv.includes("--fix");

async function main() {
  console.log("Verify techniques.level against src/lib/levels.ts");
  console.log("================================================");
  console.log(`MODE: ${FIX ? "fix (writes)" : "check only"}\n`);

  const rows = await db
    .select({
      technique: techniquesTable.technique,
      level: techniquesTable.level,
      title: techniquesTable.title,
    })
    .from(techniquesTable)
    .orderBy(techniquesTable.technique);

  const drift: Array<{ id: number; title: string; db: number | null; map: number }> =
    [];
  const missingFromDb: number[] = [];
  const unknownInDb: Array<{ id: number; title: string }> = [];

  const seen = new Set<number>();
  for (const row of rows) {
    seen.add(row.technique);
    const mapLevel = levelForTechnique(row.technique);
    if (mapLevel === null) {
      unknownInDb.push({ id: row.technique, title: row.title });
      continue;
    }
    if (row.level !== mapLevel) {
      drift.push({
        id: row.technique,
        title: row.title,
        db: row.level,
        map: mapLevel,
      });
    }
  }
  for (let id = 1; id <= MAX_TECHNIQUE_ID; id++) {
    if (!seen.has(id)) missingFromDb.push(id);
  }

  console.log(`techniques in db: ${rows.length} (map has ${MAX_TECHNIQUE_ID})`);
  for (const d of drift) {
    console.log(`  DRIFT   ${String(d.id).padStart(2)}  ${d.title}: db=${d.db} map=${d.map}`);
  }
  for (const id of missingFromDb) {
    console.log(`  MISSING ${String(id).padStart(2)}  ${TECHNIQUE_LEVELS[id].name} is not in the db`);
  }
  for (const u of unknownInDb) {
    console.log(`  UNKNOWN ${String(u.id).padStart(2)}  ${u.title} is in the db but not in the map`);
  }

  if (!drift.length && !missingFromDb.length && !unknownInDb.length) {
    console.log("\nIn sync.");
    return 0;
  }

  if (!FIX) {
    console.log(
      `\n${drift.length} drifted, ${missingFromDb.length} missing, ${unknownInDb.length} unknown.` +
        ` Re-run with --fix to rewrite the column from the map.`
    );
    return 1;
  }

  if (missingFromDb.length || unknownInDb.length) {
    console.log(
      "\nRefusing to write: the technique rows themselves disagree with the map." +
        " Fix the rows (scripts/import-techniques.ts) before syncing levels."
    );
    return 1;
  }

  await db.transaction(async tx => {
    for (const d of drift) {
      await tx
        .update(techniquesTable)
        .set({ level: d.map, updated_at: new Date() })
        .where(eq(techniquesTable.technique, d.id));
    }
  });
  console.log(`\nUpdated ${drift.length} technique rows.`);
  console.log(
    "Board levels are now stale. Run: bun run scripts/backfill-board-difficulty.ts"
  );
  return 0;
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });
