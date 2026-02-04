/**
 * Populate technique paths and dependencies
 *
 * Usage: bun run scripts/populate-technique-paths.ts
 */

import { db, techniques } from "../src/db";
import { sql } from "drizzle-orm";

// Dependencies mapping from DEPENDENCIES.md
const DEPENDENCIES: Record<number, string> = {
  1: '', // Full House - no dependencies
  2: '', // Hidden Single - no dependencies
  3: '', // Naked Single - no dependencies
  4: '2', // Hidden Pair requires Hidden Single
  5: '3', // Naked Pair requires Naked Single
  6: '2', // Locked Candidates requires Hidden Single
  7: '4', // Hidden Triple requires Hidden Pair
  8: '5', // Naked Triple requires Naked Pair
  9: '7', // Hidden Quad requires Hidden Triple
  10: '8', // Naked Quad requires Naked Triple
  11: '6', // X-Wing requires Locked Candidates
  12: '11', // Swordfish requires X-Wing
  13: '12', // Jellyfish requires Swordfish
  14: '5', // XY-Wing requires Naked Pair
  15: '11', // Finned X-Wing requires X-Wing
  16: '13', // Squirmbag requires Jellyfish
  17: '12,15', // Finned Swordfish requires Swordfish, Finned X-Wing
  18: '13,17', // Finned Jellyfish requires Jellyfish, Finned Swordfish
  19: '14', // XYZ-Wing requires XY-Wing
  20: '19', // WXYZ-Wing requires XYZ-Wing
  21: '5', // Almost Locked Sets requires Naked Pair
  22: '16,18', // Finned Squirmbag requires Squirmbag, Finned Jellyfish
  23: '34', // ALS Chain requires ALS-XZ
  24: '11', // Skyscraper requires X-Wing
  25: '11,24', // Two-String Kite requires X-Wing, Skyscraper
  26: '6', // Empty Rectangle requires Locked Candidates
  27: '11', // Simple Coloring requires X-Wing
  28: '5', // W-Wing requires Naked Pair
  29: '27', // Remote Pairs requires Simple Coloring
  30: '5', // Unique Rectangle Type 1 requires Naked Pair
  31: '30', // Unique Rectangle Type 2 requires UR Type 1
  32: '5', // BUG+1 requires Naked Pair
  33: '21,6', // Sue de Coq requires ALS, Locked Candidates
  34: '21', // ALS-XZ requires Almost Locked Sets
  35: '27', // X-Cycles requires Simple Coloring
  36: '35', // Forcing Chains requires X-Cycles
  37: '27', // Medusa Coloring requires Simple Coloring
};

async function main() {
  console.log('Populating technique paths...');

  // Update paths using SQL - convert title to lowercase, replace non-alphanumeric with hyphens
  await db.execute(sql`
    UPDATE techniques
    SET path = LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g'),
        '^-|-$', '', 'g'
      )
    )
    WHERE path IS NULL OR path = ''
  `);

  console.log('Paths populated.');

  console.log('Populating dependencies...');

  // Update dependencies for each technique
  for (const [techniqueId, deps] of Object.entries(DEPENDENCIES)) {
    if (deps) {
      await db.execute(sql`
        UPDATE techniques
        SET dependencies = ${deps}
        WHERE technique = ${parseInt(techniqueId)}
      `);
    }
  }

  console.log('Dependencies populated.');

  // Verify the results
  const results = await db.select({
    technique: techniques.technique,
    title: techniques.title,
    path: techniques.path,
    dependencies: techniques.dependencies,
  }).from(techniques).orderBy(techniques.technique);

  console.log('\nTechniques with paths and dependencies:');
  for (const row of results) {
    console.log(`  ${row.technique}. ${row.title}`);
    console.log(`     path: ${row.path || '(none)'}`);
    console.log(`     deps: ${row.dependencies || '(none)'}`);
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
