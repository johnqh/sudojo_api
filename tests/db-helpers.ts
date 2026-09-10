/**
 * Database test helpers: table setup/teardown and shared fixtures.
 *
 * Was `tests/setup.ts`. Split out because vitest setup files run for the whole
 * suite, while these helpers are imported directly by individual test files --
 * two different jobs. The guard and the module mocks now live in
 * `tests/setup.db.ts`; everything a test imports lives here.
 */
import {
  db,
  initDatabase,
  levels,
  techniques,
  learning,
  boards,
  dailies,
  challenges,
  accessLogs,
} from "../src/db";

export const API_TOKEN = "dev-secret-token-12345";
export const TEST_FIREBASE_TOKEN = "test-firebase-token";
export const TEST_USER_ID = "test-user-123";

// Mock Firebase service

// Mock RevenueCat service - always return subscribed for tests

export async function setupTestDatabase() {
  await initDatabase();
  // Clean up tables for fresh test runs
  await db.delete(accessLogs);
  await db.delete(learning);
  await db.delete(techniques);
  await db.delete(dailies);
  await db.delete(challenges);
  await db.delete(boards);
  await db.delete(levels);
}

export async function cleanupTestDatabase() {
  await db.delete(accessLogs);
  await db.delete(learning);
  await db.delete(techniques);
  await db.delete(dailies);
  await db.delete(challenges);
  await db.delete(boards);
  await db.delete(levels);
}

export async function closeTestDatabase() {
  // Note: drizzle-orm with postgres.js doesn't have a direct close method on db
  // The connection is managed by the underlying postgres client
}

// Sample test data
export const sampleBoard =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
export const sampleSolution =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

// Helper to create auth headers
export function getAuthHeaders(
  contentType: boolean = false
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TEST_FIREBASE_TOKEN}`,
  };
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}
