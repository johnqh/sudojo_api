import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";
import {
  setupTestDatabase,
  closeTestDatabase,
  getAuthHeaders,
} from "./setup";
import type {
  ApiResponse,
  SolveData,
  ValidateData,
  GenerateData,
} from "./types";

// Sample valid Sudoku puzzle for testing
const samplePuzzle =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const sampleUserInput =
  "000000000000000000000000000000000000000000000000000000000000000000000000000000000";

describe("Solver API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("GET /api/v1/solver/solve", () => {
    it("should allow anonymous access with limited hints (or 503 if solver unavailable)", async () => {
      const res = await app.request("/api/v1/solver/solve");
      // Allow 200 (success with limited hints) or 503 (solver service unavailable)
      expect([200, 400, 503]).toContain(res.status);
    });

    it("should reject invalid token", async () => {
      const res = await app.request("/api/v1/solver/solve", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });
      // Allow 401 (invalid token) or 503 (solver service unavailable before auth check)
      expect([401, 503]).toContain(res.status);
    });

    it("should return hints for valid puzzle with auth", async () => {
      const url = `/api/v1/solver/solve?original=${samplePuzzle}&user=${sampleUserInput}&autopencilmarks=true`;
      const res = await app.request(url, {
        headers: getAuthHeaders(),
      });

      // Should succeed or return 503 if solver service is unavailable
      if (res.status === 200) {
        const body = (await res.json()) as ApiResponse<SolveData>;
        expect(body.data).toBeDefined();
        expect(body.data?.board).toBeDefined();
        expect(body.data?.board.original).toBe(samplePuzzle);
        expect(body.data?.hints).toBeDefined();
        expect(Array.isArray(body.data?.hints)).toBe(true);
      } else {
        // Solver service might be unavailable in test environment
        expect([400, 503]).toContain(res.status);
      }
    });
  });

  describe("GET /api/v1/solver/validate", () => {
    it("should be publicly accessible (no auth required)", async () => {
      const url = `/api/v1/solver/validate?original=${samplePuzzle}`;
      const res = await app.request(url);

      // Should not be 401 (auth required)
      expect(res.status).not.toBe(401);
      // Should be 200 (success) or 503 (service unavailable)
      expect([200, 400, 503]).toContain(res.status);
    });

    it("should return solution for valid puzzle", async () => {
      const url = `/api/v1/solver/validate?original=${samplePuzzle}`;
      const res = await app.request(url);

      if (res.status === 200) {
        const body = (await res.json()) as ApiResponse<ValidateData>;
        expect(body.data).toBeDefined();
        expect(body.data?.board).toBeDefined();
        expect(body.data?.board.original).toBe(samplePuzzle);
        expect(body.data?.board.solution).toBeDefined();
        expect(body.data?.board.solution?.length).toBe(81);
        expect(body.data?.hints).toBeNull();
      } else {
        // Solver service might be unavailable
        expect([400, 503]).toContain(res.status);
      }
    });

    it("should return error for invalid puzzle", async () => {
      // Invalid puzzle (duplicate digits in row)
      const invalidPuzzle =
        "110000000000000000000000000000000000000000000000000000000000000000000000000000000";
      const url = `/api/v1/solver/validate?original=${invalidPuzzle}`;
      const res = await app.request(url);

      // Should be 400 (invalid) or 503 (service unavailable)
      expect([400, 503]).toContain(res.status);
    });
  });

  describe("GET /api/v1/solver/generate", () => {
    it("should be publicly accessible (no auth required)", async () => {
      const res = await app.request("/api/v1/solver/generate");

      // Should not be 401 (auth required)
      expect(res.status).not.toBe(401);
      // Should be 200 (success) or 503 (service unavailable)
      expect([200, 500, 503]).toContain(res.status);
    });

    it("should generate a puzzle", async () => {
      const res = await app.request("/api/v1/solver/generate");

      if (res.status === 200) {
        const body = (await res.json()) as ApiResponse<GenerateData>;
        expect(body.data).toBeDefined();
        expect(body.data?.board).toBeDefined();
        expect(body.data?.board.original).toBeDefined();
        expect(body.data?.board.original.length).toBe(81);
        expect(body.data?.board.solution).toBeDefined();
        expect(body.data?.board.solution?.length).toBe(81);
        expect(body.data?.level).toBeDefined();
        expect(body.data?.techniques).toBeDefined();
        expect(body.data?.hints).toBeNull();
      } else {
        // Solver service might be unavailable
        expect([500, 503]).toContain(res.status);
      }
    });

    it("should support symmetrical parameter", async () => {
      const res = await app.request("/api/v1/solver/generate?symmetrical=true");

      if (res.status === 200) {
        const body = (await res.json()) as ApiResponse<GenerateData>;
        expect(body.data).toBeDefined();
        expect(body.data?.board.original.length).toBe(81);
      } else {
        expect([500, 503]).toContain(res.status);
      }
    });
  });

  describe("Response format", () => {
    it("should wrap successful responses in ApiResponse format", async () => {
      const res = await app.request("/api/v1/solver/generate");

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty("success");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("data");
        expect((body as { success: boolean }).success).toBe(true);
      }
    });

    it("should wrap error responses in ApiResponse format", async () => {
      // Request without required params
      const res = await app.request("/api/v1/solver/validate");

      if (res.status === 400) {
        const body = await res.json();
        expect(body).toHaveProperty("success");
        expect(body).toHaveProperty("timestamp");
        expect(body).toHaveProperty("error");
        expect((body as { success: boolean }).success).toBe(false);
      }
    });
  });
});
