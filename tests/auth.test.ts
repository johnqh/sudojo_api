import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";
import { setupTestDatabase, closeTestDatabase, API_TOKEN } from "./setup";
import type { ApiResponse, LevelData } from "./types";

describe("Authentication Middleware", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("Authorization Header", () => {
    it("should reject request without Authorization header", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: 1, title: "Test" }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as ApiResponse;
      expect(body.error).toBe("Authorization header required");
    });

    it("should reject request with invalid format (no Bearer)", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: API_TOKEN,
        },
        body: JSON.stringify({ index: 1, title: "Test" }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as ApiResponse;
      expect(body.error).toBe("Invalid authorization format. Use: Bearer <token>");
    });

    it("should reject request with wrong token", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong-token",
        },
        body: JSON.stringify({ index: 1, title: "Test" }),
      });
      expect(res.status).toBe(403);
      const body = await res.json() as ApiResponse;
      expect(body.error).toBe("Invalid access token");
    });

    it("should accept request with valid token", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ index: 1, title: "Test" }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe("Public endpoints", () => {
    it("should allow GET requests without authentication", async () => {
      const res = await app.request("/api/v1/levels");
      expect(res.status).toBe(200);
    });

    it("should allow health check without authentication", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = await res.json() as { name: string; version: string; status: string };
      expect(body.name).toBe("Sudojo API");
    });
  });
});
