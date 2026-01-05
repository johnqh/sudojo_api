/**
 * populate-board-techniques.ts
 *
 * Populates the `techniques` bitfield in the `boards` table by running each board
 * through the solver API to discover all techniques used to solve it.
 *
 * Usage: bun run scripts/populate-board-techniques.ts [--limit N] [--dry-run]
 */

import { db, boards } from "../src/db";
import { eq, sql } from "drizzle-orm";
import {
  TECHNIQUE_TITLE_TO_ID,
  techniqueToBit,
  type SolveData,
} from "@sudobility/sudojo_types";

// Configuration
const SOLVER_URL = process.env.SOLVER_URL || "http://localhost:8080";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.indexOf("--limit");
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1], 10) : 0;

interface SolverResponse<T> {
  success: boolean;
  error: { code: string; message: string } | null;
  data: T | null;
}

async function callSolver(
  original: string,
  user: string,
  pencilmarks?: string
): Promise<SolveData | null> {
  const params = new URLSearchParams({
    original,
    user,
    autopencilmarks: "true",
  });
  if (pencilmarks) {
    params.set("pencilmarks", pencilmarks);
  }

  const url = `${SOLVER_URL}/api/solve?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Solver error: ${response.status}`);
      return null;
    }

    const result = (await response.json()) as SolverResponse<SolveData>;
    if (!result.success || !result.data) {
      return null;
    }

    return result.data;
  } catch (error) {
    console.error("Solver fetch error:", error);
    return null;
  }
}

function applyHint(
  user: string,
  solveData: SolveData
): { newUser: string; pencilmarks: string | null } {
  const cells = solveData.hints.steps[0]?.cells || [];
  const userArr = user.split("");

  for (const cell of cells) {
    const idx = cell.row * 9 + cell.column;
    const selectDigit = cell.actions.select;
    if (selectDigit && selectDigit !== "" && selectDigit !== "0") {
      userArr[idx] = selectDigit;
    }
  }

  // Get updated pencilmarks from the response
  const pencilmarks = solveData.board.board.pencilmarks?.pencilmarks || null;

  return { newUser: userArr.join(""), pencilmarks };
}

function isSolved(board: string): boolean {
  return !board.includes("0");
}

async function processBoard(boardRecord: {
  uuid: string;
  board: string;
  solution: string;
}): Promise<number> {
  let user = boardRecord.board;
  let pencilmarks: string | null = null;
  let techniquesBitfield = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 200;

  while (!isSolved(user) && iterations < MAX_ITERATIONS) {
    iterations++;

    const solveData = await callSolver(boardRecord.board, user, pencilmarks || undefined);
    if (!solveData) {
      console.error(`  Failed to get solve data at iteration ${iterations}`);
      break;
    }

    // Get the technique from the first hint step
    const step = solveData.hints.steps[0];
    if (!step) {
      // No more hints but not solved - shouldn't happen for valid puzzles
      console.error(`  No hints available but puzzle not solved`);
      break;
    }

    const techniqueId = TECHNIQUE_TITLE_TO_ID[step.title];
    if (techniqueId) {
      techniquesBitfield |= techniqueToBit(techniqueId);
    } else {
      console.warn(`  Unknown technique: ${step.title}`);
    }

    // Apply the hint to progress
    const result = applyHint(user, solveData);

    // Check if we made progress
    if (result.newUser === user) {
      // No cell was filled in - this hint only eliminates candidates
      // We still need to track pencilmarks and continue
      pencilmarks = result.pencilmarks;

      // For techniques that only eliminate candidates (like X-Wing),
      // we need to update pencilmarks and try again
      if (!pencilmarks) {
        console.error(`  No progress made and no pencilmarks available`);
        break;
      }
    } else {
      user = result.newUser;
      pencilmarks = result.pencilmarks;
    }
  }

  if (!isSolved(user)) {
    console.warn(
      `  Board not fully solved after ${iterations} iterations (${user.split("0").length - 1} cells remaining)`
    );
  }

  return techniquesBitfield;
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
      solution: boards.solution,
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
    console.log(
      `[${processed}/${boardsToProcess.length}] Processing ${boardRecord.uuid}...`
    );

    try {
      const techniquesBitfield = await processBoard(boardRecord);

      if (techniquesBitfield > 0) {
        console.log(`  Techniques bitfield: ${techniquesBitfield} (binary: ${techniquesBitfield.toString(2)})`);

        if (!DRY_RUN) {
          await db
            .update(boards)
            .set({
              techniques: techniquesBitfield,
              updated_at: new Date(),
            })
            .where(eq(boards.uuid, boardRecord.uuid));
          console.log(`  Updated in database`);
        } else {
          console.log(`  [DRY RUN] Would update in database`);
        }
        updated++;
      } else {
        console.log(`  No techniques found (failed to solve)`);
        failed++;
      }
    } catch (error) {
      console.error(`  Error processing board:`, error);
      failed++;
    }

    // Small delay to not overwhelm the solver
    await new Promise((resolve) => setTimeout(resolve, 50));
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
