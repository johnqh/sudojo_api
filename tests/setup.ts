/**
 * Unit-test setup. Loaded by `bun run test` — the script CI runs.
 *
 * No database is reachable from here: the guard deletes DATABASE_URL, and
 * vitest.config.ts excludes every *.db.test.ts file from collection. Both, so
 * that neither alone is load-bearing.
 */
import { scrubDatabaseUrl } from "@sudobility/test-db-guard";

process.env.NODE_ENV = "test";

scrubDatabaseUrl();
