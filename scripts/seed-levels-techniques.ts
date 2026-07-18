/**
 * Seed levels and techniques tables from sudojo_solver definitions.
 *
 * Source of truth:
 *   - SudokuEngine/SudokuDefines.h (technique IDs and names)
 *   - SudokuEngine/CSudokuRuleSolver.cpp (GetDifficultyScore; levels are DERIVED
 *     from the difficulty_score by banding in GetLevel — see docs/LEVELS.md for
 *     the band thresholds)
 *   - docs/LEVELS.md (descriptions, score table)
 *   - scripts/populate-technique-paths.ts (dependencies)
 *
 * Usage: bun run scripts/seed-levels-techniques.ts
 */

import { db, levels, techniques } from "../src/db";
import { sql } from "drizzle-orm";

// From CSudokuRuleSolver::GetLevelText() and docs/LEVELS.md
const LEVELS: Array<{
  level: number;
  title: string;
  text: string;
  requires_subscription: boolean;
}> = [
  { level: 1, title: "Beginner", text: "Just count to 8 in a house", requires_subscription: false },
  { level: 2, title: "Easy", text: "Visual scanning", requires_subscription: false },
  { level: 3, title: "Easy", text: "Simple patterns", requires_subscription: false },
  { level: 4, title: "Moderate", text: "Multiple cells to track", requires_subscription: false },
  { level: 5, title: "Challenging", text: "Small wings, turbot fish, uniqueness patterns", requires_subscription: false },
  { level: 6, title: "Hard", text: "Finned fish, coloring, quads", requires_subscription: false },
  { level: 7, title: "Very Hard", text: "Bigger wings, pair chains, X-Chain", requires_subscription: false },
  // Levels 8-12 are paywalled (see init.ts entitlement/offer_id seeding, and the
  // live DB). Keep requires_subscription=true here so re-running this seed does
  // NOT wipe the paywall flag. entitlement/offer_id are owned by init.ts.
  { level: 8, title: "Expert", text: "Big fish and bivalue chains", requires_subscription: true },
  { level: 9, title: "Master", text: "Almost Locked Sets and big wings", requires_subscription: true },
  { level: 10, title: "Master", text: "Finned big fish, Sue de Coq, grouped cycles", requires_subscription: true },
  { level: 11, title: "Extreme", text: "AIC, ALS chains, whole-grid coloring", requires_subscription: true },
  { level: 12, title: "Extreme", text: "Bifurcation: forcing chains and nets", requires_subscription: true },
];

// From SudokuDefines.h + CSudokuRuleSolver::GetLevel() + docs/LEVELS.md + populate-technique-paths.ts
// Grouped by level; within a level, ordered by difficulty_score (the solve order).
const TECHNIQUES: Array<{
  technique: number;
  level: number;
  title: string;
  text: string;
  dependencies: string;
}> = [
  // Level 1
  { technique: 1, level: 1, title: "Full House", text: "Count to 8 in a house, find the missing digit", dependencies: "" },
  // Level 2
  { technique: 3, level: 2, title: "Naked Single", text: "One candidate left in cell", dependencies: "" },
  { technique: 2, level: 2, title: "Hidden Single", text: "Scan row/col/box for unique candidate", dependencies: "" },
  // Level 3
  { technique: 6, level: 3, title: "Locked Candidates", text: "Candidates locked in line within box", dependencies: "2" },
  { technique: 5, level: 3, title: "Naked Pair", text: "Two cells with same two candidates", dependencies: "3" },
  { technique: 30, level: 3, title: "Unique Rectangle Type 1", text: "UR with one extra candidate corner", dependencies: "5" },
  { technique: 4, level: 3, title: "Hidden Pair", text: "Two numbers only appear in two cells", dependencies: "2" },
  // Level 4
  { technique: 32, level: 4, title: "BUG+1", text: "Bivalue Universal Grave", dependencies: "5" },
  { technique: 11, level: 4, title: "X-Wing", text: "2x2 fish pattern", dependencies: "6" },
  { technique: 31, level: 4, title: "Unique Rectangle Type 2", text: "UR with extra candidate in floor", dependencies: "30" },
  { technique: 8, level: 4, title: "Naked Triple", text: "Three cells to track simultaneously", dependencies: "5" },
  { technique: 24, level: 4, title: "Skyscraper", text: "Two conjugate pairs sharing endpoint", dependencies: "11" },
  // Level 5
  { technique: 14, level: 5, title: "XY-Wing", text: "Pivot + two pincers", dependencies: "5" },
  { technique: 25, level: 5, title: "Two-String Kite", text: "Row + column pairs through box", dependencies: "11,24" },
  { technique: 28, level: 5, title: "W-Wing", text: "Bivalue cells + strong link", dependencies: "5" },
  { technique: 38, level: 5, title: "Crane", text: "Box pair + line pair (Turbot Fish)", dependencies: "" },
  { technique: 40, level: 5, title: "Unique Rectangle Type 4", text: "UR conjugate pair", dependencies: "" },
  { technique: 41, level: 5, title: "Unique Rectangle Type 5", text: "UR diagonal extra", dependencies: "" },
  { technique: 55, level: 5, title: "Firework", text: "Row-column intersection pattern", dependencies: "" },
  { technique: 7, level: 5, title: "Hidden Triple", text: "Three numbers in exactly three cells", dependencies: "4" },
  { technique: 19, level: 5, title: "XYZ-Wing", text: "Pivot has 3 candidates", dependencies: "14" },
  { technique: 26, level: 5, title: "Empty Rectangle", text: "Box pattern with strong link", dependencies: "6" },
  { technique: 50, level: 5, title: "Avoidable Rectangle", text: "UR with determined corners", dependencies: "" },
  // Level 6
  { technique: 15, level: 6, title: "Finned X-Wing", text: "X-Wing with fin exception", dependencies: "11" },
  { technique: 39, level: 6, title: "Unique Rectangle Type 3", text: "UR pseudo-naked pair", dependencies: "" },
  { technique: 27, level: 6, title: "Simple Coloring", text: "Single-digit on/off coloring", dependencies: "11" },
  { technique: 51, level: 6, title: "Sashimi X-Wing", text: "Sashimi variant of X-Wing", dependencies: "" },
  { technique: 10, level: 6, title: "Naked Quad", text: "Four cells with four candidates", dependencies: "8" },
  { technique: 12, level: 6, title: "Swordfish", text: "3x3 fish pattern", dependencies: "11" },
  { technique: 54, level: 6, title: "Hidden Unique Rectangle", text: "UR with hidden pair digits", dependencies: "" },
  // Level 7
  { technique: 20, level: 7, title: "WXYZ-Wing", text: "4-cell wing pattern", dependencies: "19" },
  { technique: 29, level: 7, title: "Remote Pairs", text: "Chain of identical bivalue cells", dependencies: "27" },
  { technique: 57, level: 7, title: "Franken X-Wing", text: "Mixed house fish 2x2", dependencies: "" },
  { technique: 9, level: 7, title: "Hidden Quad", text: "Four numbers in four cells", dependencies: "7" },
  { technique: 42, level: 7, title: "X-Chain", text: "Single-digit open chain", dependencies: "" },
  // Level 8
  { technique: 17, level: 8, title: "Finned Swordfish", text: "Swordfish with fin", dependencies: "12,15" },
  { technique: 44, level: 8, title: "VWXYZ-Wing", text: "5-cell wing", dependencies: "" },
  { technique: 52, level: 8, title: "Sashimi Swordfish", text: "Sashimi variant of Swordfish", dependencies: "" },
  { technique: 43, level: 8, title: "XY-Chain", text: "Bivalue cell chain", dependencies: "" },
  { technique: 13, level: 8, title: "Jellyfish", text: "4x4 fish pattern", dependencies: "12" },
  { technique: 35, level: 8, title: "X-Cycles", text: "Alternating inference chains", dependencies: "27" },
  // Level 9
  { technique: 21, level: 9, title: "Almost Locked Sets", text: "ALS-XY (N cells, N+1 candidates)", dependencies: "5" },
  { technique: 34, level: 9, title: "ALS-XZ", text: "Two ALS with restricted common", dependencies: "21" },
  { technique: 45, level: 9, title: "UVWXYZ-Wing", text: "6-cell wing", dependencies: "" },
  { technique: 58, level: 9, title: "Franken Swordfish", text: "Mixed house fish 3x3", dependencies: "" },
  // Level 10
  { technique: 18, level: 10, title: "Finned Jellyfish", text: "Jellyfish with fin", dependencies: "13,17" },
  { technique: 33, level: 10, title: "Sue de Coq", text: "Complex set intersections", dependencies: "21,6" },
  { technique: 60, level: 10, title: "Grouped X-Cycles", text: "X-Cycles with grouped nodes", dependencies: "" },
  { technique: 53, level: 10, title: "Sashimi Jellyfish", text: "Sashimi variant of Jellyfish", dependencies: "" },
  { technique: 16, level: 10, title: "Squirmbag", text: "5x5 fish pattern", dependencies: "13" },
  { technique: 46, level: 10, title: "TUVWXYZ-Wing", text: "7-cell wing", dependencies: "" },
  // Level 11
  { technique: 48, level: 11, title: "AIC", text: "Alternating Inference Chain (mixed)", dependencies: "" },
  { technique: 47, level: 11, title: "STUVWXYZ-Wing", text: "8-cell wing", dependencies: "" },
  { technique: 22, level: 11, title: "Finned Squirmbag", text: "Squirmbag with fin", dependencies: "16,18" },
  { technique: 23, level: 11, title: "ALS Chain", text: "Multiple ALS connected", dependencies: "34" },
  { technique: 37, level: 11, title: "3D Medusa", text: "Multi-digit coloring", dependencies: "27" },
  { technique: 59, level: 11, title: "Franken Jellyfish", text: "Mixed house fish 4x4", dependencies: "" },
  { technique: 56, level: 11, title: "Death Blossom", text: "Stem cell with ALS petals", dependencies: "" },
  // Level 12
  { technique: 36, level: 12, title: "Forcing Chains", text: "If-then bifurcation logic", dependencies: "35" },
  { technique: 49, level: 12, title: "Forcing Net", text: "Cell/Region Forcing Net (3+ branches)", dependencies: "" },
];

async function main() {
  // Seed levels
  console.log("Seeding levels...");
  await db.insert(levels).values(LEVELS).onConflictDoUpdate({
    target: levels.level,
    set: {
      title: sql`EXCLUDED.title`,
      text: sql`EXCLUDED.text`,
      requires_subscription: sql`EXCLUDED.requires_subscription`,
      updated_at: new Date(),
    },
  });
  console.log(`Seeded ${LEVELS.length} levels`);

  // Seed techniques
  console.log("Seeding techniques...");
  for (const t of TECHNIQUES) {
    await db.insert(techniques).values({
      technique: t.technique,
      level: t.level,
      title: t.title,
      text: t.text,
      dependencies: t.dependencies || null,
      path: t.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    }).onConflictDoUpdate({
      target: techniques.technique,
      set: {
        level: sql`EXCLUDED.level`,
        title: sql`EXCLUDED.title`,
        text: sql`EXCLUDED.text`,
        dependencies: sql`EXCLUDED.dependencies`,
        path: sql`EXCLUDED.path`,
        updated_at: new Date(),
      },
    });
  }
  console.log(`Seeded ${TECHNIQUES.length} techniques`);

  console.log("Done!");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
