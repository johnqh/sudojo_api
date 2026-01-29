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
import type { ApiResponse, LearningData } from "./types";

describe("Learning API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
    // Create a level first
    await app.request("/api/v1/levels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ level: 1, title: "Easy" }),
    });

    // Create a technique
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
  });

  describe("GET /api/v1/learning", () => {
    it("should return empty array when no learning entries exist", async () => {
      const res = await app.request("/api/v1/learning", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LearningData[]>;
      expect(body.data).toEqual([]);
    });

    it("should filter by technique", async () => {
      await app.request("/api/v1/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          language_code: "en",
          text: "Step 1",
        }),
      });

      const res = await app.request("/api/v1/learning?technique=1", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LearningData[]>;
      expect(body.data!.length).toBe(1);
    });

    it("should filter by language_code", async () => {
      await app.request("/api/v1/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          language_code: "es",
          text: "Paso 1",
        }),
      });

      const res = await app.request("/api/v1/learning?language_code=es", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LearningData[]>;
      expect(body.data!.length).toBe(1);
      expect(body.data![0].language_code).toBe("es");
    });
  });

  describe("POST /api/v1/learning", () => {
    it("should create a learning entry", async () => {
      const res = await app.request("/api/v1/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          language_code: "en",
          text: "Look for cells with only one candidate",
          image_url: "https://example.com/image.png",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as ApiResponse<LearningData>;
      expect(body.data!.text).toBe("Look for cells with only one candidate");
      expect(body.data!.image_url).toBe("https://example.com/image.png");
    });

    it("should reject request without auth", async () => {
      const res = await app.request("/api/v1/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          text: "Test",
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/learning/:uuid", () => {
    it("should return 404 for non-existent learning entry", async () => {
      const res = await app.request(
        "/api/v1/learning/00000000-0000-0000-0000-000000000000",
        { headers: getAuthHeaders() }
      );
      expect(res.status).toBe(404);
    });

    it("should return learning entry by uuid", async () => {
      const createRes = await app.request("/api/v1/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          language_code: "fr",
          text: "Etape 1",
        }),
      });
      const created = (await createRes.json()) as ApiResponse<LearningData>;

      const res = await app.request(`/api/v1/learning/${created.data!.uuid}`, {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LearningData>;
      expect(body.data!.language_code).toBe("fr");
    });
  });

  describe("PUT /api/v1/learning/:uuid", () => {
    it("should update a learning entry", async () => {
      const createRes = await app.request("/api/v1/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          text: "Original text",
        }),
      });
      const created = (await createRes.json()) as ApiResponse<LearningData>;

      const res = await app.request(`/api/v1/learning/${created.data!.uuid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ text: "Updated text" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<LearningData>;
      expect(body.data!.text).toBe("Updated text");
    });
  });

  describe("DELETE /api/v1/learning/:uuid", () => {
    it("should delete a learning entry", async () => {
      const createRes = await app.request("/api/v1/learning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          technique: 1,
          index: 1,
          text: "ToDelete",
        }),
      });
      const created = (await createRes.json()) as ApiResponse<LearningData>;

      const res = await app.request(`/api/v1/learning/${created.data!.uuid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status).toBe(200);

      const getRes = await app.request(
        `/api/v1/learning/${created.data!.uuid}`,
        { headers: getAuthHeaders() }
      );
      expect(getRes.status).toBe(404);
    });
  });
});
