/**
 * Import boards from MySQL dump into PostgreSQL.
 *
 * Both MySQL and PostgreSQL use the same convention:
 *   board    = puzzle (givens + zeros for blanks)
 *   solution = solved cells only (zeros where givens are)
 *
 * Usage: bun run scripts/import-boards.ts [path-to-sql-dump]
 */

import { db, boards } from "../src/db";
import { sql } from "drizzle-orm";

const dumpPath =
  process.argv[2] ||
  "/Users/johnhuang/Documents/dumps/db_sudoku_sudokuservice_boards.sql";

const content = await Bun.file(dumpPath).text();

const insertMatch = content.match(
  /INSERT INTO `sudokuservice_boards` VALUES (.+);/s
);
if (!insertMatch) {
  console.error("Could not find INSERT statement");
  process.exit(1);
}

const valuesStr = insertMatch[1];

const records: Array<{
  uuid: string;
  board: string;
  solution: string;
  symmetrical: boolean;
}> = [];

const regex =
  /\((\d+),'([^']+)','([^']*)','([^']+)','([^']+)',(\d+),(\d+),([^,]+),([^,]+),(\d+)\)/g;
let match;

while ((match = regex.exec(valuesStr)) !== null) {
  const [, , uuid, , mysqlBoard, mysqlSolution, symmetrical, status] = match;

  // Only import active records (status = 1)
  if (status !== "1") continue;

  records.push({
    uuid,
    board: mysqlBoard,
    solution: mysqlSolution,
    symmetrical: symmetrical === "1",
  });
}

console.log(`Found ${records.length} active board records to import`);

if (records.length === 0) {
  console.log("No records to import");
  process.exit(0);
}

// Insert in batches (no level or techniques)
const BATCH_SIZE = 500;
let imported = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);

  await db
    .insert(boards)
    .values(batch)
    .onConflictDoUpdate({
      target: boards.uuid,
      set: {
        board: sql`EXCLUDED.board`,
        solution: sql`EXCLUDED.solution`,
        symmetrical: sql`EXCLUDED.symmetrical`,
        updated_at: new Date(),
      },
    });

  imported += batch.length;
  console.log(`Imported ${imported}/${records.length} boards`);
}

console.log("Done!");
process.exit(0);
