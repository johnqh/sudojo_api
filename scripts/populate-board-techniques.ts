/**
 * populate-board-techniques.ts
 *
 * Populates the `techniques` bitfield in the `boards` table by running each board
 * through the solver /validate endpoint.
 *
 * Usage: bun run scripts/populate-board-techniques.ts [--limit N] [--dry-run]
 */

import { db, boards } from "../src/db";
import { eq } from "drizzle-orm";

// Configuration
const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8080";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.indexOf("--limit");
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : 0;

interface ValidateResponse {
  success: boolean;
  error: { code: string; message: string } | null;
  data: {
    board: {
      level: number;
      techniques: number;
      board: {
        original: string;
        solution: string;
      };
    };
  } | null;
}

async function validateBoard(original: string): Promise<{ techniques: number; level: number } | null> {
  const url = `${SOLVER_URL}/api/validate?original=${original}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Solver error: ${response.status}`);
      return null;
    }

    const result = (await response.json()) as ValidateResponse;
    if (!result.success || !result.data) {
      return null;
    }

    return {
      techniques: result.data.board.techniques,
      level: result.data.board.level,
    };
  } catch (error) {
    console.error("Solver fetch error:", error);
    return null;
  }
}

async function main() {
  console.log("Populate Board Techniques");
  console.log("========================");
  console.log(`SOLVER_URL: ${SOLVER_URL}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`LIMIT: ${LIMIT || "none"}`);
  console.log();

  // Get boards with techniques = 0
  let query = db
    .select({
      uuid: boards.uuid,
      board: boards.board,
    })
    .from(boards)
    .where(eq(boards.techniques, 0));

  if (LIMIT > 0) {
    query = query.limit(LIMIT) as typeof query;
  }

  const boardsToProcess = await query;
  console.log(`Found ${boardsToProcess.length} boards with techniques = 0\n`);

  if (boardsToProcess.length === 0) {
    console.log("Nothing to do!");
    process.exit(0);
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const boardRecord of boardsToProcess) {
    processed++;

    try {
      const result = await validateBoard(boardRecord.board);

      if (result && result.techniques > 0) {
        if (!DRY_RUN) {
          await db
            .update(boards)
            .set({
              techniques: result.techniques,
              updated_at: new Date(),
            })
            .where(eq(boards.uuid, boardRecord.uuid));
        }
        updated++;

        if (processed % 100 === 0 || processed === boardsToProcess.length) {
          console.log(
            `[${processed}/${boardsToProcess.length}] Updated ${updated}, Failed ${failed}`
          );
        }
      } else {
        failed++;
        console.log(
          `[${processed}/${boardsToProcess.length}] Failed: ${boardRecord.uuid.slice(0, 8)}...`
        );
      }
    } catch (error) {
      console.error(`Error processing ${boardRecord.uuid}:`, error);
      failed++;
    }

    // Small delay to not overwhelm the solver
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  console.log("\n========================");
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log("Done!");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
