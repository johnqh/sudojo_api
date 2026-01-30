import { sql } from "drizzle-orm";
import { getDb } from "../src/db";

async function resetTechniques() {
  const db = getDb();
  
  console.log("Updating all boards to set techniques = 0...");
  
  const result = await db.execute(sql`UPDATE boards SET techniques = 0`);
  
  console.log("Done. Updated records.");
  process.exit(0);
}

resetTechniques().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
