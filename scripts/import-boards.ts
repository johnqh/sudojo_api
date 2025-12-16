import { db, boards } from "../src/db";
import { sql } from "drizzle-orm";

const file = Bun.file("/Users/johnhuang/sudoku_dump/db_sudoku_sudokuservice_boards.sql");
const content = await file.text();

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
  level_uuid: string | null;
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
    records.push({
      uuid,
      level_uuid: level_uuid || null,
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
      level_uuid: sql`EXCLUDED.level_uuid`,
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
