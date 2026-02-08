/**
 * export-technique-fixtures.ts
 *
 * Exports one practice per technique from the database to a JSON fixture file.
 * This fixture is used for automated testing of solver techniques.
 *
 * Usage: bun run scripts/export-technique-fixtures.ts
 */

import { db, techniquePractices, techniques } from "../src/db";
import { eq, sql } from "drizzle-orm";

interface TechniqueFixture {
  technique: number;
  technique_title: string;
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
    // Get one random practice for this technique
    const practices = await db
      .select()
      .from(techniquePractices)
      .where(eq(techniquePractices.technique, tech.technique))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (practices.length > 0) {
      fixtures.push({
        technique: tech.technique,
        technique_title: tech.title,
        board: practices[0].board,
        pencilmarks: practices[0].pencilmarks,
        solution: practices[0].solution,
      });
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
