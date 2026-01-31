import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getRequiredEnv } from "../lib/env-helper";
import { initRateLimitTable } from "@sudobility/ratelimit_service";

// Lazy initialization to allow test env to be applied first
let _client: ReturnType<typeof postgres> | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getClient() {
  if (!_client) {
    const connectionString = getRequiredEnv("DATABASE_URL");
    _client = postgres(connectionString);
  }
  return _client;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// For backwards compatibility - but prefer getDb() for test isolation
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

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
      text TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
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

export async function closeDatabase() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

/**
 * Initialize gamification tables
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
