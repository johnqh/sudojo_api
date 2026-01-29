import { db, techniques, levels } from "../src/db";
import { sql } from "drizzle-orm";

const file = Bun.file("/Users/johnhuang/sudoku_dump/db_sudoku_sudokuservice_techniques.sql");
const content = await file.text();

// First, we need to build a mapping from old uuid to level number
// Read the levels dump to build the mapping
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
// Format: (id,'uuid','level_uuid',index,'title','text',status,'create_time','update_time')
const insertMatch = content.match(/INSERT INTO `sudokuservice_techniques` VALUES (.+);/s);
if (!insertMatch) {
  console.error("Could not find INSERT statement");
  process.exit(1);
}

const valuesStr = insertMatch[1];

const records: Array<{
  technique: number;
  level: number | null;
  title: string;
  text: string | null;
}> = [];

// Parse: (id,'uuid','level_uuid',index,'title','text',status,create_time,update_time)
const regex = /\((\d+),'([^']+)','([^']*)',(\d+),(?:'([^']*)'|NULL),(?:'([^']*)'|NULL),(\d+),([^,]+),([^)]+)\)/g;
let match;

while ((match = regex.exec(valuesStr)) !== null) {
  const [, , , level_uuid, index, title, text, status] = match;

  // Only import active records (status = 1)
  if (status === "1") {
    // Map level_uuid to level (integer)
    const level = level_uuid ? levelUuidToIndex[level_uuid] ?? null : null;

    records.push({
      technique: parseInt(index),
      level,
      title: title || "",
      text: text || null,
    });
  }
}

console.log(`Found ${records.length} active technique records to import`);

if (records.length === 0) {
  console.log("No records to import");
  process.exit(0);
}

// Insert with upsert
await db.insert(techniques).values(records).onConflictDoUpdate({
  target: techniques.technique,
  set: {
    level: sql`EXCLUDED.level`,
    title: sql`EXCLUDED.title`,
    text: sql`EXCLUDED.text`,
    updated_at: new Date(),
  },
});

console.log(`Imported ${records.length} techniques`);
process.exit(0);
