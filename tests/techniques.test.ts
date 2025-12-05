import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { app } from "../src/index";
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, API_TOKEN } from "./setup";
import type { ApiResponse, LevelData, TechniqueData } from "./types";

describe("Techniques API", () => {
  let levelUuid: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    const levelRes = await app.request("/api/v1/levels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ index: 1, title: "Easy" }),
    });
    const levelBody = await levelRes.json() as ApiResponse<LevelData>;
    levelUuid = levelBody.data!.uuid;
  });

  describe("GET /api/v1/techniques", () => {
    it("should return empty array when no techniques exist", async () => {
      const res = await app.request("/api/v1/techniques");
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<TechniqueData[]>;
      expect(body.data).toEqual([]);
    });

    it("should filter by level_uuid", async () => {
      await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          level_uuid: levelUuid,
          index: 1,
          title: "Naked Singles",
        }),
      });

      const res = await app.request(`/api/v1/techniques?level_uuid=${levelUuid}`);
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<TechniqueData[]>;
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
          level_uuid: levelUuid,
          index: 1,
          title: "Naked Singles",
          text: "Find cells with only one possible value",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as ApiResponse<TechniqueData>;
      expect(body.data!.title).toBe("Naked Singles");
    });

    it("should reject request without auth", async () => {
      const res = await app.request("/api/v1/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level_uuid: levelUuid,
          index: 1,
          title: "Test",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/techniques/:uuid", () => {
    it("should return 404 for non-existent technique", async () => {
      const res = await app.request("/api/v1/techniques/00000000-0000-0000-0000-000000000000");
      expect(res.status).toBe(404);
    });

    it("should return technique by uuid", async () => {
      const createRes = await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          level_uuid: levelUuid,
          index: 1,
          title: "Hidden Singles",
        }),
      });
      const created = await createRes.json() as ApiResponse<TechniqueData>;

      const res = await app.request(`/api/v1/techniques/${created.data!.uuid}`);
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<TechniqueData>;
      expect(body.data!.title).toBe("Hidden Singles");
    });
  });

  describe("PUT /api/v1/techniques/:uuid", () => {
    it("should update a technique", async () => {
      const createRes = await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          level_uuid: levelUuid,
          index: 1,
          title: "Original",
        }),
      });
      const created = await createRes.json() as ApiResponse<TechniqueData>;

      const res = await app.request(`/api/v1/techniques/${created.data!.uuid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ title: "Updated" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as ApiResponse<TechniqueData>;
      expect(body.data!.title).toBe("Updated");
    });
  });

  describe("DELETE /api/v1/techniques/:uuid", () => {
    it("should delete a technique", async () => {
      const createRes = await app.request("/api/v1/techniques", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          level_uuid: levelUuid,
          index: 1,
          title: "ToDelete",
        }),
      });
      const created = await createRes.json() as ApiResponse<TechniqueData>;

      const res = await app.request(`/api/v1/techniques/${created.data!.uuid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status).toBe(200);

      const getRes = await app.request(`/api/v1/techniques/${created.data!.uuid}`);
      expect(getRes.status).toBe(404);
    });
  });
});
