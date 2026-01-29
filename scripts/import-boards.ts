import { db, boards } from "../src/db";
import { sql } from "drizzle-orm";

const file = Bun.file("/Users/johnhuang/sudoku_dump/db_sudoku_sudokuservice_boards.sql");
const content = await file.text();

// First, build a mapping from old level_uuid to level number
const levelsFile = Bun.file("/Users/johnhuang/sudoku_dump/db_sudoku_sudokuservice_levels.sql");
const levelsContent = await levelsFile.text();

const levelUuidToIndex: Record<string, number> = {};
const levelsInsertMatch = levelsContent.match(/INSERT INTO `sudokuservice_levels` VALUES (.+);/s);
if (levelsInsertMatch) {
  const levelsRegex = /\((\d+),'([^']+)',(\d+),'([^']+)',(?:'([^']*)'|NULL),(\d+),(\d+),([^,]+),([^)]+)\)/g;
  let levelMatch;
  while ((levelMatch = levelsRegex.exec(levelsInsertMatch[1])) !== null) {
    const [, , uuid, index, , , , status] = levelMatch;
    if (status === "1") {
      levelUuidToIndex[uuid] = parseInt(index);
    }
  }
}

console.log(`Built level UUID mapping with ${Object.keys(levelUuidToIndex).length} levels`);

// Extract the INSERT statement values
const insertMatch = content.match(/INSERT INTO `sudokuservice_boards` VALUES (.+);/s);
if (!insertMatch) {
  console.error("Could not find INSERT statement");
  process.exit(1);
}

const valuesStr = insertMatch[1];

// Parse the values - format: (id,'uuid','level_uuid','board','solution',symmetrical,status,'create_time','update_time',techniques)
const records: Array<{
  uuid: string;
  level: number | null;
  board: string;
  solution: string;
  symmetrical: boolean;
  techniques: number;
}> = [];

// Split by ),( but need to handle it carefully
const regex = /\((\d+),'([^']+)','([^']*)','([^']+)','([^']+)',(\d+),(\d+),([^,]+),([^,]+),(\d+)\)/g;
let match;

while ((match = regex.exec(valuesStr)) !== null) {
  const [, , uuid, level_uuid, board, solution, symmetrical, status, , , techniques] = match;

  // Only import active records (status = 1)
  if (status === "1") {
    // Map level_uuid to level (integer)
    const level = level_uuid ? levelUuidToIndex[level_uuid] ?? null : null;

    records.push({
      uuid,
      level,
      board,
      solution,
      symmetrical: symmetrical === "1",
      techniques: parseInt(techniques),
    });
  }
}

console.log(`Found ${records.length} active board records to import`);

// Insert in batches
const BATCH_SIZE = 500;
let imported = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);

  await db.insert(boards).values(batch).onConflictDoUpdate({
    target: boards.uuid,
    set: {
      level: sql`EXCLUDED.level`,
      board: sql`EXCLUDED.board`,
      solution: sql`EXCLUDED.solution`,
      symmetrical: sql`EXCLUDED.symmetrical`,
      techniques: sql`EXCLUDED.techniques`,
      updated_at: new Date(),
    },
  });

  imported += batch.length;
  console.log(`Imported ${imported}/${records.length} boards`);
}

console.log("Done!");
process.exit(0);
