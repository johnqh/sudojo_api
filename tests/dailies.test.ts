import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { app } from "../src/index";
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, API_TOKEN, sampleBoard, sampleSolution } from "./setup";
import type { ApiResponse, DailyData } from "./types";

describe("Dailies API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/v1/dailies", () => {
    it("should return empty array when no dailies exist", async () => {
      const res = await app.request("/api/v1/dailies");
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<DailyData[]>;
      expect(body.data).toEqual([]);
    });
  });

  describe("POST /api/v1/dailies", () => {
    it("should create a daily puzzle", async () => {
      const res = await app.request("/api/v1/dailies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          date: "2024-01-15",
          board: sampleBoard,
          solution: sampleSolution,
          techniques: 3,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as ApiResponse<DailyData>;
      expect(body.data!.date).toContain("2024-01-15");
    });

    it("should reject invalid date format", async () => {
      const res = await app.request("/api/v1/dailies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          date: "01-15-2024",
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should reject request without auth", async () => {
      const res = await app.request("/api/v1/dailies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2024-01-15",
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/dailies/date/:date", () => {
    it("should return 404 for non-existent date", async () => {
      const res = await app.request("/api/v1/dailies/date/2024-01-01");
      expect(res.status).toBe(404);
    });

    it("should return daily by date", async () => {
      await app.request("/api/v1/dailies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          date: "2024-02-20",
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });

      const res = await app.request("/api/v1/dailies/date/2024-02-20");
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<DailyData>;
      expect(body.data!.date).toContain("2024-02-20");
    });
  });

  describe("GET /api/v1/dailies/random", () => {
    it("should return 404 when no dailies exist", async () => {
      const res = await app.request("/api/v1/dailies/random");
      expect(res.status).toBe(404);
    });

    it("should return a random daily", async () => {
      await app.request("/api/v1/dailies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          date: "2024-03-10",
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });

      const res = await app.request("/api/v1/dailies/random");
      expect(res.status).toBe(200);
    });
  });

  describe("PUT /api/v1/dailies/:uuid", () => {
    it("should update a daily", async () => {
      const createRes = await app.request("/api/v1/dailies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          date: "2024-04-01",
          board: sampleBoard,
          solution: sampleSolution,
          techniques: 1,
        }),
      });
      const created = await createRes.json() as ApiResponse<DailyData>;

      const res = await app.request(`/api/v1/dailies/${created.data!.uuid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ techniques: 5 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<DailyData>;
      expect(body.data!.techniques).toBe(5);
    });
  });

  describe("DELETE /api/v1/dailies/:uuid", () => {
    it("should delete a daily", async () => {
      const createRes = await app.request("/api/v1/dailies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          date: "2024-05-01",
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });
      const created = await createRes.json() as ApiResponse<DailyData>;

      const res = await app.request(`/api/v1/dailies/${created.data!.uuid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status).toBe(200);
    });
  });
});
