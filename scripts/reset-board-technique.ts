import { sql } from "drizzle-orm";
import { getDb } from "../src/db";

async function resetBoardTechnique() {
  const db = getDb();

  console.log("Setting techniques = 0 for all boards...");

  const result = await db.execute(
    sql`UPDATE boards SET techniques = 0`
  );

  console.log("Done.");
  process.exit(0);
}

resetBoardTechnique().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
