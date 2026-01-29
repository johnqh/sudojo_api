import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../src/index";
import {
  setupTestDatabase,
  closeTestDatabase,
  API_TOKEN,
  getAuthHeaders,
} from "./setup";
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
      const body = (await res.json()) as ApiResponse;
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
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toBe(
        "Invalid authorization format. Use: Bearer <token>"
      );
    });

    it("should reject GET request with wrong token on protected endpoint", async () => {
      const res = await app.request("/api/v1/solver/solve", {
        headers: {
          Authorization: "Bearer wrong-token",
        },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiResponse;
      expect(body.error).toContain("Invalid or expired");
    });

    it("should accept request with valid admin token", async () => {
      const res = await app.request("/api/v1/levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ level: 1, title: "Test" }),
      });
      expect(res.status).toBe(201);
    });

    it("should accept GET request with valid Firebase token", async () => {
      const res = await app.request("/api/v1/levels", {
        headers: getAuthHeaders(),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Access Control", () => {
    it("should allow anonymous access to solver/solve with limited hints (or 503 if unavailable)", async () => {
      const res = await app.request("/api/v1/solver/solve");
      // Solver allows anonymous with limited hints, or 503 if service unavailable
      expect([200, 400, 503]).toContain(res.status);
    });

    it("should allow public GET requests without authentication (boards)", async () => {
      const res = await app.request("/api/v1/boards");
      expect(res.status).toBe(200);
    });

    it("should allow public GET requests without authentication (levels)", async () => {
      const res = await app.request("/api/v1/levels");
      expect(res.status).toBe(200);
    });

    it("should allow public GET requests without authentication (techniques)", async () => {
      const res = await app.request("/api/v1/techniques");
      expect(res.status).toBe(200);
    });

    it("should allow public GET requests without authentication (learning)", async () => {
      const res = await app.request("/api/v1/learning");
      expect(res.status).toBe(200);
    });

    it("should allow health check without authentication", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse<{
        name: string;
        version: string;
        status: string;
      }>;
      expect(body.data?.name).toBe("Sudojo API");
    });
  });
});
