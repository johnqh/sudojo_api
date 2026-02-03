import { sql } from "drizzle-orm";
import { getDb } from "../src/db";

async function resetTechniques() {
  const db = getDb();

  console.log("Updating all boards to set techniques = 0...");
  await db.execute(sql`UPDATE boards SET techniques = 0`);
  console.log("Done updating boards.");

  console.log("Deleting all technique_examples...");
  await db.execute(sql`DELETE FROM technique_examples`);
  console.log("Done deleting technique_examples.");

  process.exit(0);
}

resetTechniques().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
