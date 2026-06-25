/**
 * export-technique-fixtures.ts
 *
 * Exports one practice per technique from the database to a JSON fixture file.
 * This fixture is used for automated testing of solver techniques.
 *
 * Usage: bun run scripts/export-technique-fixtures.ts
 */

import {
  db,
  techniquePractices,
  techniqueExamples,
  boards,
  techniques,
} from "../src/db";
import { eq, sql } from "drizzle-orm";

interface TechniqueFixture {
  technique: number;
  technique_title: string;
  // Original givens, emitted only when they differ from `board` (the current/solved
  // state). Some techniques - Avoidable Rectangle especially - need the given vs
  // solved distinction; the test reads `original` as the puzzle and `board` as user.
  original?: string;
  board: string;
  pencilmarks: string | null;
  solution: string;
}

async function exportFixtures() {
  console.log("Exporting technique fixtures...");

  // Get all techniques ordered by technique ID
  const allTechniques = await db
    .select()
    .from(techniques)
    .orderBy(techniques.technique);

  console.log(`Found ${allTechniques.length} techniques`);

  const fixtures: TechniqueFixture[] = [];
  const missing: string[] = [];

  for (const tech of allTechniques) {
    // Get one random practice for this technique, joining back to the source
    // example -> source board to recover the original givens (the practice `board`
    // is the current/solved state).
    const practices = await db
      .select({
        board: techniquePractices.board,
        pencilmarks: techniquePractices.pencilmarks,
        solution: techniquePractices.solution,
        original: boards.board,
      })
      .from(techniquePractices)
      .leftJoin(
        techniqueExamples,
        eq(techniquePractices.source_example_uuid, techniqueExamples.uuid)
      )
      .leftJoin(boards, eq(techniqueExamples.source_board_uuid, boards.uuid))
      .where(eq(techniquePractices.technique, tech.technique))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (practices.length > 0) {
      const p = practices[0];
      const fixture: TechniqueFixture = {
        technique: tech.technique,
        technique_title: tech.title,
        board: p.board,
        pencilmarks: p.pencilmarks,
        solution: p.solution,
      };
      // Only carry `original` when the givens actually differ from the board.
      if (p.original && p.original !== p.board) {
        fixture.original = p.original;
      }
      fixtures.push(fixture);
      console.log(`  [${tech.technique}] ${tech.title}: found practice`);
    } else {
      missing.push(`${tech.technique} (${tech.title})`);
      console.log(`  [${tech.technique}] ${tech.title}: NO PRACTICE DATA`);
    }
  }

  // Write to local fixtures location
  const outputPath = new URL("../tests/fixtures/technique-practices.json", import.meta.url);
  await Bun.write(outputPath.pathname, JSON.stringify(fixtures, null, 2));

  console.log(`\nExported ${fixtures.length} technique fixtures to tests/fixtures/technique-practices.json`);

  if (missing.length > 0) {
    console.log(`\nWARNING: ${missing.length} techniques have no practice data:`);
    for (const m of missing) {
      console.log(`  - ${m}`);
    }
  }

  process.exit(0);
}

exportFixtures().catch((err) => {
  console.error("Error exporting fixtures:", err);
  process.exit(1);
});
