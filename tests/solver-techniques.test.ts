/**
 * Solver Technique Integration Tests
 *
 * Tests that for each technique with practice data, the /solve endpoint
 * returns a hint using the expected technique when filtered to that technique.
 *
 * Requires the C# solver service to be running at SOLVER_URL.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "fs";
import { app } from "../src/index";
import {
  setupTestDatabase,
  closeTestDatabase,
  getAuthHeaders,
} from "./setup";
import type { SolveData } from "@sudobility/sudojo_types";

// Fixture type matching exported JSON
interface TechniqueFixture {
  technique: number;
  technique_title: string;
  board: string;
  pencilmarks: string | null;
  solution: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Load fixtures synchronously at module load time
const fixturesPath = new URL(
  "../../test-fixtures/technique-practices.json",
  import.meta.url
);
const fixtures: TechniqueFixture[] = JSON.parse(
  fs.readFileSync(fixturesPath.pathname, "utf-8")
);

// Empty board (81 zeros) - no additional user input beyond the practice board
const EMPTY_USER = "0".repeat(81);

// Empty pencilmarks (80 commas for 81 empty elements)
const EMPTY_PENCILMARKS = ",".repeat(80);

describe("Solver Technique Tests", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("Each technique returns correct hint", () => {
    // Generate a test for each fixture
    for (const fixture of fixtures) {
      it(`technique ${fixture.technique} (${fixture.technique_title}) returns correct hint`, async () => {
        // Build request URL with technique filter
        const params = new URLSearchParams({
          original: fixture.board,
          user: EMPTY_USER,
          autopencilmarks: "true",
          pencilmarks: fixture.pencilmarks ?? EMPTY_PENCILMARKS,
          techniques: String(fixture.technique),
        });

        const url = `/api/v1/solver/solve?${params.toString()}`;

        const res = await app.request(url, {
          headers: getAuthHeaders(),
        });

        // Handle solver unavailable case
        if (res.status === 503) {
          console.warn(
            `Solver unavailable for technique ${fixture.technique} (${fixture.technique_title})`
          );
          // Skip this test gracefully - don't fail the suite
          return;
        }

        // Verify successful response
        expect(res.status).toBe(200);

        const body = (await res.json()) as ApiResponse<SolveData>;
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data?.hints).toBeDefined();

        // Verify the technique matches
        const actualTechnique = body.data?.hints?.technique ?? 0;
        expect(actualTechnique).toBe(fixture.technique);
      });
    }
  });

  describe("Technique coverage", () => {
    it("should have fixtures for all expected techniques", () => {
      // We expect 37 techniques (1-37)
      expect(fixtures.length).toBe(37);

      // Verify all technique IDs are present
      const techniqueIds = fixtures.map((f) => f.technique).sort((a, b) => a - b);
      const expectedIds = Array.from({ length: 37 }, (_, i) => i + 1);
      expect(techniqueIds).toEqual(expectedIds);
    });
  });
});
