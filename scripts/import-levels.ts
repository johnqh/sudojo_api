import { db, levels } from "../src/db";
import { sql } from "drizzle-orm";

const file = Bun.file("/Users/johnhuang/sudoku_dump/db_sudoku_sudokuservice_levels.sql");
const content = await file.text();

// Extract the INSERT statement values
// Format: (id,'uuid',index,'title','text',requires_subscription,status,'create_time','update_time')
const insertMatch = content.match(/INSERT INTO `sudokuservice_levels` VALUES (.+);/s);
if (!insertMatch) {
  console.error("Could not find INSERT statement");
  process.exit(1);
}

const valuesStr = insertMatch[1];

const records: Array<{
  uuid: string;
  index: number;
  title: string;
  text: string | null;
  requires_subscription: boolean;
}> = [];

// Parse: (id,'uuid',index,'title','text',requires_subscription,status,create_time,update_time)
const regex = /\((\d+),'([^']+)',(\d+),'([^']+)',(?:'([^']*)'|NULL),(\d+),(\d+),([^,]+),([^)]+)\)/g;
let match;

while ((match = regex.exec(valuesStr)) !== null) {
  const [, , uuid, index, title, text, requires_subscription, status] = match;

  // Only import active records (status = 1)
  if (status === "1") {
    records.push({
      uuid,
      index: parseInt(index),
      title,
      text: text || null,
      requires_subscription: requires_subscription === "1",
    });
  }
}

console.log(`Found ${records.length} active level records to import`);

if (records.length === 0) {
  console.log("No records to import");
  process.exit(0);
}

// Insert with upsert
await db.insert(levels).values(records).onConflictDoUpdate({
  target: levels.uuid,
  set: {
    index: sql`EXCLUDED.index`,
    title: sql`EXCLUDED.title`,
    text: sql`EXCLUDED.text`,
    requires_subscription: sql`EXCLUDED.requires_subscription`,
    updated_at: new Date(),
  },
});

console.log(`Imported ${records.length} levels`);
process.exit(0);
