/**
 * One-time script to update technique dependencies for techniques 38-60.
 * Verified against C++ solver implementation in sudojo_solver.
 *
 * Run: bunx tsx scripts/update-technique-dependencies.ts
 */

import { getDb } from "../src/db/index.js";
import { techniques } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

const DEPENDENCY_UPDATES: Record<number, string> = {
  // Level 5
  38: "11", // Crane → X-Wing (conjugate pairs)

  // Level 6
  50: "30", // Avoidable Rectangle → UR Type 1

  // Level 7
  39: "30", // UR Type 3 → UR Type 1
  40: "30", // UR Type 4 → UR Type 1
  51: "15", // Sashimi X-Wing → Finned X-Wing

  // Level 8
  41: "30", // UR Type 5 → UR Type 1
  54: "30", // Hidden UR → UR Type 1
  55: "11", // Firework → X-Wing (conjugate pairs)

  // Level 9
  42: "27", // X-Chain → Simple Coloring
  52: "17", // Sashimi Swordfish → Finned Swordfish
  53: "18", // Sashimi Jellyfish → Finned Jellyfish

  // Level 10
  43: "14", // XY-Chain → XY-Wing
  44: "20", // VWXYZ-Wing → WXYZ-Wing
  45: "44", // UVWXYZ-Wing → VWXYZ-Wing
  57: "11", // Franken X-Wing → X-Wing
  58: "12,57", // Franken Swordfish → Swordfish, Franken X-Wing

  // Level 11
  46: "45", // TUVWXYZ-Wing → UVWXYZ-Wing
  47: "46", // STUVWXYZ-Wing → TUVWXYZ-Wing
  56: "34", // Death Blossom → ALS-XZ
  59: "13,58", // Franken Jellyfish → Jellyfish, Franken Swordfish
  60: "35", // Grouped X-Cycles → X-Cycles

  // Level 12
  48: "35,43", // AIC → X-Cycles, XY-Chain
  49: "36", // Forcing Net → Forcing Chains
};

async function main() {
  const db = getDb();

  for (const [techniqueId, deps] of Object.entries(DEPENDENCY_UPDATES)) {
    const id = parseInt(techniqueId, 10);
    const rows = await db
      .update(techniques)
      .set({ dependencies: deps, updated_at: new Date() })
      .where(eq(techniques.technique, id))
      .returning();

    if (rows.length > 0) {
      console.log(`  ✓ ${id} ${rows[0]!.title}: dependencies = ${deps}`);
    } else {
      console.log(`  ✗ ${id}: not found`);
    }
  }

  console.log("\nDone. Updated", Object.keys(DEPENDENCY_UPDATES).length, "techniques.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
