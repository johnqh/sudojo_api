/**
 * @fileoverview Database initialization and connection management
 *
 * Uses PostgreSQL via postgres.js driver with Drizzle ORM.
 * Database initialization uses raw SQL CREATE TABLE IF NOT EXISTS statements
 * for idempotent table creation and ALTER TABLE for migrations.
 *
 * Schema versioning strategy:
 * - Tables are created with CREATE TABLE IF NOT EXISTS (idempotent)
 * - Column additions use ALTER TABLE ADD COLUMN IF NOT EXISTS (idempotent)
 * - No rollback mechanism - migrations are forward-only
 * - Table creation order respects foreign key dependencies:
 *   levels -> techniques -> learning, boards -> dailies/challenges,
 *   badge_definitions -> user_badges, technique_examples -> technique_practices
 *
 * @see schema.ts for Drizzle ORM schema definitions (kept in sync with raw SQL)
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getRequiredEnv } from "../lib/env-helper";
import { initRateLimitTable } from "@sudobility/ratelimit_service";

// Lazy initialization to allow test env to be applied first
let _client: ReturnType<typeof postgres> | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Get the raw postgres.js client (lazily initialized).
 * Connection string is read from DATABASE_URL environment variable.
 */
function getClient() {
  if (!_client) {
    const connectionString = getRequiredEnv("DATABASE_URL");
    _client = postgres(connectionString);
  }
  return _client;
}

/**
 * Get the Drizzle ORM database instance (lazily initialized).
 * Prefer this over the `db` proxy for new code.
 */
export function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

/**
 * Proxy-based database accessor for backwards compatibility.
 * Delegates all property access to the lazily-initialized Drizzle instance.
 * Prefer `getDb()` for explicit initialization control in tests.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * Initialize core database tables using raw SQL.
 *
 * Creates tables in dependency order:
 * 1. levels (no dependencies)
 * 2. techniques (references levels)
 * 3. learning (references techniques)
 * 4. boards (references levels)
 * 5. dailies (references boards, levels)
 * 6. challenges (references boards, levels)
 * 7. access_logs (no dependencies)
 * 8. technique_examples (references boards)
 * 9. technique_practices (references techniques, technique_examples)
 * 10. rate_limit_counters (via ratelimit_service)
 *
 * All statements are idempotent (IF NOT EXISTS).
 * Column migrations use ALTER TABLE ADD COLUMN IF NOT EXISTS.
 *
 * @throws Error if DATABASE_URL is not set or database is unreachable
 */
export async function initDatabase() {
  const client = getClient();
  // Create tables if they don't exist
  await client`
    CREATE TABLE IF NOT EXISTS levels (
      level INTEGER PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      text TEXT,
      requires_subscription BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS techniques (
      technique INTEGER PRIMARY KEY,
      level INTEGER REFERENCES levels(level) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      path VARCHAR(255),
      dependencies TEXT,
      text TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Migration: add columns that may be missing from older schema
  await client`
    ALTER TABLE techniques ADD COLUMN IF NOT EXISTS path VARCHAR(255)
  `;
  await client`
    ALTER TABLE techniques ADD COLUMN IF NOT EXISTS dependencies TEXT
  `;

  await client`
    CREATE INDEX IF NOT EXISTS techniques_path_idx ON techniques(path)
  `;

  await client`
    CREATE TABLE IF NOT EXISTS learning (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique INTEGER REFERENCES techniques(technique) ON DELETE CASCADE,
      index INTEGER NOT NULL,
      language_code VARCHAR(10) NOT NULL DEFAULT 'en',
      text TEXT,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS boards (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      level INTEGER REFERENCES levels(level) ON DELETE SET NULL,
      symmetrical BOOLEAN DEFAULT false,
      board VARCHAR(81) NOT NULL,
      solution VARCHAR(81) NOT NULL,
      techniques INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS dailies (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE UNIQUE NOT NULL,
      board_uuid UUID REFERENCES boards(uuid) ON DELETE SET NULL,
      level INTEGER REFERENCES levels(level) ON DELETE SET NULL,
      techniques INTEGER DEFAULT 0,
      board VARCHAR(81) NOT NULL,
      solution VARCHAR(81) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS challenges (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      board_uuid UUID REFERENCES boards(uuid) ON DELETE SET NULL,
      level INTEGER REFERENCES levels(level) ON DELETE SET NULL,
      difficulty INTEGER DEFAULT 1,
      board VARCHAR(81) NOT NULL,
      solution VARCHAR(81) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS access_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(128) NOT NULL,
      endpoint VARCHAR(50) NOT NULL,
      access_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS technique_examples (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      board VARCHAR(81) NOT NULL,
      pencilmarks TEXT,
      solution VARCHAR(81) NOT NULL,
      techniques_bitfield INTEGER NOT NULL,
      primary_technique INTEGER NOT NULL,
      hint_data TEXT,
      source_board_uuid UUID REFERENCES boards(uuid) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS technique_practices (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique INTEGER REFERENCES techniques(technique) ON DELETE CASCADE,
      board VARCHAR(81) NOT NULL,
      pencilmarks TEXT,
      solution VARCHAR(81) NOT NULL,
      hint_data TEXT,
      source_example_uuid UUID REFERENCES technique_examples(uuid) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Rate limit counters table (from @sudobility/subscription_service)
  await initRateLimitTable(client, null, "sudojo");

  console.log("Database tables initialized");
}

/**
 * Close the database connection and reset cached instances.
 * Should be called during graceful shutdown or after test runs.
 */
export async function closeDatabase() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

/**
 * Initialize gamification-related database tables.
 *
 * Creates tables in dependency order:
 * 1. user_stats (user points, level, games completed)
 * 2. badge_definitions (badge types and requirements)
 * 3. user_badges (earned badges, references badge_definitions)
 * 4. game_sessions (active game state, one per user)
 * 5. point_transactions (audit trail for all point changes)
 *
 * Also creates performance indexes on user_badges, point_transactions.
 * All statements are idempotent (IF NOT EXISTS).
 *
 * @throws Error if database connection fails
 */
export async function initGamificationTables() {
  const client = getClient();

  // User stats table
  await client`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id VARCHAR(128) PRIMARY KEY,
      total_points BIGINT NOT NULL DEFAULT 0,
      user_level INTEGER NOT NULL DEFAULT 0,
      games_completed INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Badge definitions table
  await client`
    CREATE TABLE IF NOT EXISTS badge_definitions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      badge_type VARCHAR(50) NOT NULL,
      badge_key VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      icon_url VARCHAR(500),
      requirement_value INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // User badges table
  await client`
    CREATE TABLE IF NOT EXISTS user_badges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(128) NOT NULL,
      badge_key VARCHAR(100) NOT NULL REFERENCES badge_definitions(badge_key),
      earned_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, badge_key)
    )
  `;

  // Game sessions table (one active session per user)
  await client`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(128) UNIQUE NOT NULL,
      board VARCHAR(81) NOT NULL,
      solution VARCHAR(81) NOT NULL,
      level INTEGER NOT NULL,
      techniques BIGINT DEFAULT 0,
      hint_used BOOLEAN NOT NULL DEFAULT FALSE,
      hints_count INTEGER NOT NULL DEFAULT 0,
      hint_points_earned INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      puzzle_type VARCHAR(20) NOT NULL,
      puzzle_id VARCHAR(100)
    )
  `;

  // Point transactions table (audit trail)
  await client`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(128) NOT NULL,
      points INTEGER NOT NULL,
      transaction_type VARCHAR(50) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Create indexes for better query performance
  await client`
    CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id)
  `;

  await client`
    CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON point_transactions(user_id)
  `;

  await client`
    CREATE INDEX IF NOT EXISTS idx_point_transactions_created_at ON point_transactions(created_at)
  `;

  console.log("Gamification tables initialized");
}

// Re-export schema for convenience
export * from "./schema";
