import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { app } from "../src/index";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
  API_TOKEN,
  sampleBoard,
  sampleSolution,
  getAuthHeaders,
} from "./setup";
import type { ApiResponse, ChallengeData } from "./types";

describe("Challenges API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/v1/challenges", () => {
    it("should return empty array when no challenges exist", async () => {
      const res = await app.request("/api/v1/challenges", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ChallengeData[]>;
      expect(body.data).toEqual([]);
    });

    it("should filter by difficulty", async () => {
      await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 3,
        }),
      });

      await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 7,
        }),
      });

      const res = await app.request("/api/v1/challenges?difficulty=3", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ChallengeData[]>;
      expect(body.data!.length).toBe(1);
      expect(body.data![0].difficulty).toBe(3);
    });
  });

  describe("POST /api/v1/challenges", () => {
    it("should create a challenge", async () => {
      const res = await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 5,
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as ApiResponse<ChallengeData>;
      expect(body.data!.difficulty).toBe(5);
    });

    it("should reject invalid difficulty", async () => {
      const res = await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 15,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should reject request without auth", async () => {
      const res = await app.request("/api/v1/challenges", {
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

  describe("GET /api/v1/challenges/random", () => {
    it("should return 404 when no challenges exist", async () => {
      const res = await app.request("/api/v1/challenges/random", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(404);
    });

    it("should return a random challenge", async () => {
      await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 4,
        }),
      });

      const res = await app.request("/api/v1/challenges/random", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ChallengeData>;
      expect(body.data!.board).toBe(sampleBoard);
    });

    it("should filter random by difficulty", async () => {
      await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 8,
        }),
      });

      const res = await app.request("/api/v1/challenges/random?difficulty=8", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ChallengeData>;
      expect(body.data!.difficulty).toBe(8);
    });
  });

  describe("GET /api/v1/challenges/:uuid", () => {
    it("should return 404 for non-existent challenge", async () => {
      const res = await app.request(
        "/api/v1/challenges/00000000-0000-0000-0000-000000000000",
        { headers: getAuthHeaders() }
      );
      expect(res.status).toBe(404);
    });

    it("should return challenge by uuid", async () => {
      const createRes = await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 2,
        }),
      });
      const created = (await createRes.json()) as ApiResponse<ChallengeData>;

      const res = await app.request(
        `/api/v1/challenges/${created.data!.uuid}`,
        { headers: getAuthHeaders() }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ChallengeData>;
      expect(body.data!.difficulty).toBe(2);
    });
  });

  describe("PUT /api/v1/challenges/:uuid", () => {
    it("should update a challenge", async () => {
      const createRes = await app.request("/api/v1/challenges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          board: sampleBoard,
          solution: sampleSolution,
          difficulty: 3,
        }),
      });
      const created = (await createRes.json()) as ApiResponse<ChallengeData>;

      const res = await app.request(
        `/api/v1/challenges/${created.data!.uuid}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
          },
          body: JSON.stringify({ difficulty: 9 }),
        }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<ChallengeData>;
      expect(body.data!.difficulty).toBe(9);
    });
  });

  describe("DELETE /api/v1/challenges/:uuid", () => {
    it("should delete a challenge", async () => {
      const createRes = await app.request("/api/v1/challenges", {
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
      const created = (await createRes.json()) as ApiResponse<ChallengeData>;

      const res = await app.request(
        `/api/v1/challenges/${created.data!.uuid}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${API_TOKEN}` },
        }
      );
      expect(res.status).toBe(200);
    });
  });
});
