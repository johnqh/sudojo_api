// Safety check: ensure we're using the test database
const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl.includes("_test")) {
  throw new Error(
    `SAFETY CHECK FAILED: Tests must run against a test database!\n` +
    `Current DATABASE_URL: ${dbUrl}\n` +
    `Expected: a database name ending with '_test'\n` +
    `Make sure bunfig.toml has [test.env] file = ".env.test" and .env.test uses sudojo_test`
  );
}

import { mock } from "bun:test";
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
mock.module("../src/services/firebase", () => ({
  verifyIdToken: async (token: string) => {
    if (token === TEST_FIREBASE_TOKEN || token === API_TOKEN) {
      return {
        uid: TEST_USER_ID,
        email: "test@example.com",
        firebase: {
          sign_in_provider: "password",
        },
      };
    }
    throw new Error("Invalid token");
  },
  isAnonymousUser: (decodedToken: { firebase?: { sign_in_provider?: string } }) => {
    return decodedToken.firebase?.sign_in_provider === "anonymous";
  },
  isSiteAdmin: (email: string | undefined) => {
    // In tests, consider test@example.com as admin
    return email === "test@example.com";
  },
  getUserInfo: (decodedToken: { uid: string; email?: string }) => ({
    uid: decodedToken.uid,
    email: decodedToken.email,
  }),
  extendTokenCacheTTL: (_token: string, _ttlMs: number) => {
    // No-op in tests
  },
  getFirebaseApp: () => ({}),
}));

// Mock RevenueCat service - always return subscribed for tests
mock.module("../src/services/revenuecat", () => ({
  getSubscriberEntitlements: async (_userId: string) => ({
    hasSubscription: true,
    entitlements: [
      {
        identifier: "sudojo",
        isActive: true,
        willRenew: true,
        periodType: "normal",
        latestPurchaseDate: new Date().toISOString(),
        originalPurchaseDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        store: "app_store",
        productIdentifier: "sudojo_monthly",
        isSandbox: true,
        unsubscribeDetectedAt: null,
        billingIssueDetectedAt: null,
      },
    ],
  }),
}));

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
