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
  getAuthHeaders,
} from "./setup";
import type { ApiResponse, TechniqueData } from "./types";

describe("Techniques API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    // Create a level first (techniques require a level)
    await app.request("/api/v1/levels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ level: 1, title: "Easy" }),
    });
  });

  describe("GET /api/v1/techniques", () => {
    it("should return empty array when no techniques exist", async () => {
      const res = await app.request("/api/v1/techniques", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<TechniqueData[]>;
      expect(body.data).toEqual([]);
    });

    it("should filter by level", async () => {
      await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          level: 1,
          title: "Naked Singles",
        }),
      });

      const res = await app.request("/api/v1/techniques?level=1", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<TechniqueData[]>;
      expect(body.data!.length).toBe(1);
    });
  });

  describe("POST /api/v1/techniques", () => {
    it("should create a technique", async () => {
      const res = await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          level: 1,
          title: "Naked Singles",
          text: "Find cells with only one possible value",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as ApiResponse<TechniqueData>;
      expect(body.data!.title).toBe("Naked Singles");
      expect(body.data!.technique).toBe(1);
    });

    it("should reject request without auth", async () => {
      const res = await app.request("/api/v1/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technique: 1,
          level: 1,
          title: "Test",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/techniques/:technique", () => {
    it("should return 404 for non-existent technique", async () => {
      const res = await app.request("/api/v1/techniques/37", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid technique format", async () => {
      const res = await app.request("/api/v1/techniques/invalid", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(400);
    });

    it("should return technique by technique number", async () => {
      await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 2,
          level: 1,
          title: "Hidden Singles",
        }),
      });

      const res = await app.request("/api/v1/techniques/2", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<TechniqueData>;
      expect(body.data!.title).toBe("Hidden Singles");
    });
  });

  describe("PUT /api/v1/techniques/:technique", () => {
    it("should update a technique", async () => {
      await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          level: 1,
          title: "Original",
        }),
      });

      const res = await app.request("/api/v1/techniques/1", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<TechniqueData>;
      expect(body.data!.title).toBe("Updated");
    });
  });

  describe("DELETE /api/v1/techniques/:technique", () => {
    it("should delete a technique", async () => {
      await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          level: 1,
          title: "ToDelete",
        }),
      });

      const res = await app.request("/api/v1/techniques/1", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status).toBe(200);

      const getRes = await app.request("/api/v1/techniques/1", {
        headers: getAuthHeaders(),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
