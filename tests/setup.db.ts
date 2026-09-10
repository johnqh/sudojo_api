/**
 * Database-test setup. Loaded by `bun run test:db` only — never by CI.
 *
 * Throws unless TEST_DATABASE_URL names a localhost database, then publishes it
 * as DATABASE_URL for the application code to read. This replaces the old
 * `dbUrl.includes("_test")` substring check, which passed for any database
 * whose name happened to contain "test".
 *
 * The module mocks below were `mock.module` calls from `bun:test`. `vi.mock` is
 * the vitest equivalent and is hoisted, so it must live in a setup file or a
 * test file — not in an imported helper module.
 */
import { existsSync, readFileSync } from "node:fs";
import { vi } from "vitest";
import { setupTestDatabase } from "@sudobility/test-db-guard";

/**
 * Load `.env.test` for SOLVER_URL, FIREBASE_* and friends.
 *
 * `bunfig.toml` used to do this via `[test.env] file = ".env.test"`, which is
 * Bun test-runner config; vitest ignores it, and without this the suite dies on
 * `Required environment variable SOLVER_URL is not set`.
 *
 * Deliberately loads `.env.test` ONLY. Loading `.env` would pull in this repo's
 * real DATABASE_URL, which points at a remote host. `setupTestDatabase()` below
 * would scrub it, but the file should never be read here in the first place.
 */
function loadEnvTest(): void {
  const path = new URL("../.env.test", import.meta.url).pathname;
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Never override a variable already in the environment. dotenv semantics,
    // and load-bearing here: an explicitly exported TEST_DATABASE_URL must win
    // over the file, or the guard can never be exercised against a bad value —
    // the file would quietly restore the safe one and the refusal would not fire.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvTest();

process.env.NODE_ENV = "test";

setupTestDatabase();

// NOTE: literals are inlined inside the factories below rather than referenced
// from consts. `vi.mock` is hoisted above everything else in this file, so a
// factory that closes over a module-level const fails with "cannot access
// before initialization". These values must match tests/db-helpers.ts.

vi.mock("../src/services/firebase", () => ({
  verifyIdToken: async (token: string) => {
    if (token === "test-firebase-token" || token === "dev-secret-token-12345") {
      return {
        uid: "test-user-123",
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
  // Account deletion. Mirrors DeleteUserAccountResult from
  // @sudobility/auth_service: the route reads googleTokenRevoked and
  // appleTokenRevoked and logs when either is explicitly false, so null --
  // meaning "not attempted" -- is the correct value for a test that passes
  // no OAuth tokens.
  deleteUserAccount: async (_userId: string, _options?: unknown) => ({
    userDeleted: true,
    googleTokenRevoked: null,
    appleTokenRevoked: null,
  }),
  // Apple Sign In is not configured in tests. The route passes the result
  // through as `appleConfig ?? undefined`, so null exercises that path.
  getAppleSignInConfig: () => null,
}));

vi.mock("../src/services/revenuecat", () => ({
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
