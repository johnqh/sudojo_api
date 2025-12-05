import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { app } from "../src/index";
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, API_TOKEN, sampleBoard, sampleSolution } from "./setup";
import type { ApiResponse, BoardData } from "./types";

describe("Boards API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/v1/boards", () => {
    it("should return empty array when no boards exist", async () => {
      const res = await app.request("/api/v1/boards");
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<BoardData[]>;
      expect(body.data).toEqual([]);
    });

    it("should return all boards", async () => {
      await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          symmetrical: true,
        }),
      });

      const res = await app.request("/api/v1/boards");
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<BoardData[]>;
      expect(body.data!.length).toBe(1);
    });
  });

  describe("POST /api/v1/boards", () => {
    it("should create a board with valid token", async () => {
      const res = await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          symmetrical: true,
          techniques: 5,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as ApiResponse<BoardData>;
      expect(body.data!.board).toBe(sampleBoard);
      expect(body.data!.symmetrical).toBe(true);
    });

    it("should reject board with invalid length", async () => {
      const res = await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: "12345",
          solution: sampleSolution,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should reject request without auth", async () => {
      const res = await app.request("/api/v1/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/boards/random", () => {
    it("should return 404 when no boards exist", async () => {
      const res = await app.request("/api/v1/boards/random");
      expect(res.status).toBe(404);
    });

    it("should return a random board", async () => {
      await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });

      const res = await app.request("/api/v1/boards/random");
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<BoardData>;
      expect(body.data!.board).toBe(sampleBoard);
    });
  });

  describe("GET /api/v1/boards/:uuid", () => {
    it("should return 404 for non-existent board", async () => {
      const res = await app.request("/api/v1/boards/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
    });

    it("should return board by uuid", async () => {
      const createRes = await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });
      const created = await createRes.json() as ApiResponse<BoardData>;

      const res = await app.request(`/api/v1/boards/${created.data!.uuid}`);
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<BoardData>;
      expect(body.data!.board).toBe(sampleBoard);
    });
  });

  describe("PUT /api/v1/boards/:uuid", () => {
    it("should update a board", async () => {
      const createRes = await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          symmetrical: false,
        }),
      });
      const created = await createRes.json() as ApiResponse<BoardData>;

      const res = await app.request(`/api/v1/boards/${created.data!.uuid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ symmetrical: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<BoardData>;
      expect(body.data!.symmetrical).toBe(true);
    });
  });

  describe("DELETE /api/v1/boards/:uuid", () => {
    it("should delete a board", async () => {
      const createRes = await app.request("/api/v1/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
        }),
      });
      const created = await createRes.json() as ApiResponse<BoardData>;

      const res = await app.request(`/api/v1/boards/${created.data!.uuid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status).toBe(200);

      const getRes = await app.request(`/api/v1/boards/${created.data!.uuid}`);
      expect(getRes.status).toBe(404);
    });
  });
});
