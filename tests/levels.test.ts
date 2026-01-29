import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { app } from "../src/index";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  closeTestDatabase,
  API_TOKEN,
  getAuthHeaders,
} from "./setup";
import type { ApiResponse, LevelData } from "./types";

describe("Levels API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /api/v1/levels", () => {
    it("should return empty array when no levels exist", async () => {
      const res = await app.request("/api/v1/levels", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LevelData[]>;
      expect(body.data).toEqual([]);
    });

    it("should return all levels", async () => {
      // Create a level first
      await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ level: 1, title: "Easy", text: "Easy puzzles" }),
      });

      const res = await app.request("/api/v1/levels", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LevelData[]>;
      expect(body.data!.length).toBe(1);
      expect(body.data![0].title).toBe("Easy");
    });
  });

  describe("POST /api/v1/levels", () => {
    it("should reject request without auth token", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 1, title: "Easy" }),
      });
      expect(res.status).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({ level: 1, title: "Easy" }),
      });
      // Invalid tokens are rejected with 401 Unauthorized
      expect(res.status).toBe(401);
    });

    it("should create a level with valid token", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          level: 1,
          title: "Easy",
          text: "Easy puzzles for beginners",
          requires_subscription: false,
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as ApiResponse<LevelData>;
      expect(body.data!.title).toBe("Easy");
      expect(body.data!.level).toBe(1);
    });

    it("should reject invalid data", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ level: "not-a-number", title: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/levels/:level", () => {
    it("should return 404 for non-existent level", async () => {
      const res = await app.request("/api/v1/levels/12", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid level format", async () => {
      const res = await app.request("/api/v1/levels/invalid", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(400);
    });

    it("should return level by level number", async () => {
      // Create a level first
      await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ level: 1, title: "Medium" }),
      });

      const res = await app.request("/api/v1/levels/1", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LevelData>;
      expect(body.data!.title).toBe("Medium");
    });
  });

  describe("PUT /api/v1/levels/:level", () => {
    it("should update a level", async () => {
      // Create a level first
      await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ level: 1, title: "Easy" }),
      });

      const res = await app.request("/api/v1/levels/1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ title: "Very Easy" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LevelData>;
      expect(body.data!.title).toBe("Very Easy");
    });

    it("should reject update without auth", async () => {
      const res = await app.request("/api/v1/levels/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/levels/:level", () => {
    it("should delete a level", async () => {
      // Create a level first
      await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ level: 1, title: "ToDelete" }),
      });

      const res = await app.request("/api/v1/levels/1", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status).toBe(200);

      // Verify it's deleted
      const getRes = await app.request("/api/v1/levels/1", {
        headers: getAuthHeaders(),
      });
      expect(getRes.status).toBe(404);
    });

    it("should reject delete without auth", async () => {
      const res = await app.request("/api/v1/levels/1", {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });
});
