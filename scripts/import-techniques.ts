import { db, techniques } from "../src/db";
import { sql } from "drizzle-orm";

const file = Bun.file("/Users/johnhuang/sudoku_dump/db_sudoku_sudokuservice_techniques.sql");
const content = await file.text();

// Extract the INSERT statement values
// Format: (id,'uuid','level_uuid',index,'title','text',status,'create_time','update_time')
const insertMatch = content.match(/INSERT INTO `sudokuservice_techniques` VALUES (.+);/s);
if (!insertMatch) {
  console.error("Could not find INSERT statement");
  process.exit(1);
}

const valuesStr = insertMatch[1];

const records: Array<{
  uuid: string;
  level_uuid: string | null;
  index: number;
  title: string;
  text: string | null;
}> = [];

// Parse: (id,'uuid','level_uuid',index,'title','text',status,create_time,update_time)
const regex = /\((\d+),'([^']+)','([^']*)',(\d+),(?:'([^']*)'|NULL),(?:'([^']*)'|NULL),(\d+),([^,]+),([^)]+)\)/g;
let match;

while ((match = regex.exec(valuesStr)) !== null) {
  const [, , uuid, level_uuid, index, title, text, status] = match;

  // Only import active records (status = 1)
  if (status === "1") {
    records.push({
      uuid,
      level_uuid: level_uuid || null,
      index: parseInt(index),
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
  target: techniques.uuid,
  set: {
    level_uuid: sql`EXCLUDED.level_uuid`,
    index: sql`EXCLUDED.index`,
    title: sql`EXCLUDED.title`,
    text: sql`EXCLUDED.text`,
    updated_at: new Date(),
  },
});

console.log(`Imported ${records.length} techniques`);
process.exit(0);
