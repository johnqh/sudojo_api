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
    it("should allow anonymous access with limited hints", async () => {
      const url = `/api/v1/solver/solve?original=${samplePuzzle}&user=${sampleUserInput}&autopencilmarks=true`;
      const res = await app.request(url);
      expect(res.status).toBe(200);

      const body = (await res.json()) as ApiResponse<SolveData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data?.board).toBeDefined();
    });

    it("should reject invalid token", async () => {
      const res = await app.request("/api/v1/solver/solve", {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });
      expect(res.status).toBe(401);
    });

    it("should return hints for valid puzzle with auth", async () => {
      const url = `/api/v1/solver/solve?original=${samplePuzzle}&user=${sampleUserInput}&autopencilmarks=true`;
      const res = await app.request(url, {
        headers: getAuthHeaders(),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<SolveData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data?.board).toBeDefined();
      expect(body.data?.board.original).toBe(samplePuzzle);
      expect(body.data?.hints).toBeDefined();
      expect(Array.isArray(body.data?.hints)).toBe(true);
    });
  });

  describe("GET /api/v1/solver/validate", () => {
    it("should be publicly accessible (no auth required)", async () => {
      const url = `/api/v1/solver/validate?original=${samplePuzzle}`;
      const res = await app.request(url);

      expect(res.status).not.toBe(401);
      expect(res.status).toBe(200);
    });

    it("should return solution for valid puzzle", async () => {
      const url = `/api/v1/solver/validate?original=${samplePuzzle}`;
      const res = await app.request(url);

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ValidateData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data?.board).toBeDefined();
      expect(body.data?.board.original).toBe(samplePuzzle);
      expect(body.data?.board.solution).toBeDefined();
      expect(body.data?.board.solution?.length).toBe(81);
      expect(body.data?.board.level).toBeDefined();
      expect(body.data?.board.techniques).toBeDefined();
    });

    it("should return error for invalid puzzle", async () => {
      // Invalid puzzle (duplicate digits in row)
      const invalidPuzzle =
        "110000000000000000000000000000000000000000000000000000000000000000000000000000000";
      const url = `/api/v1/solver/validate?original=${invalidPuzzle}`;
      const res = await app.request(url);

      expect(res.status).toBe(400);
      const body = (await res.json()) as ApiResponse<ValidateData>;
      expect(body.success).toBe(false);
    });

    it("should return 400 for missing original parameter", async () => {
      const res = await app.request("/api/v1/solver/validate");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/solver/generate", () => {
    it("should be publicly accessible (no auth required)", async () => {
      const res = await app.request("/api/v1/solver/generate");

      expect(res.status).not.toBe(401);
      expect(res.status).toBe(200);
    });

    it("should generate a puzzle", async () => {
      const res = await app.request("/api/v1/solver/generate");

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<GenerateData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data?.board).toBeDefined();
      expect(body.data?.board.original).toBeDefined();
      expect(body.data?.board.original.length).toBe(81);
      expect(body.data?.board.solution).toBeDefined();
      expect(body.data?.board.solution?.length).toBe(81);
      expect(body.data?.board.level).toBeDefined();
      expect(body.data?.board.techniques).toBeDefined();
    });

    it("should support symmetrical parameter", async () => {
      const res = await app.request("/api/v1/solver/generate?symmetrical=true");

      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<GenerateData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data?.board.original.length).toBe(81);
    });
  });

  describe("Response format", () => {
    it("should wrap successful responses in ApiResponse format", async () => {
      const res = await app.request("/api/v1/solver/generate");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("data");
      expect((body as { success: boolean }).success).toBe(true);
    });

    it("should wrap error responses in ApiResponse format", async () => {
      const res = await app.request("/api/v1/solver/validate");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("timestamp");
      expect(body).toHaveProperty("error");
      expect((body as { success: boolean }).success).toBe(false);
    });
  });
});
