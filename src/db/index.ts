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
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      index INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      text TEXT,
      requires_subscription BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS techniques (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      level_uuid UUID REFERENCES levels(uuid) ON DELETE CASCADE,
      index INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      text TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS learning (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_uuid UUID REFERENCES techniques(uuid) ON DELETE CASCADE,
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
      level_uuid UUID REFERENCES levels(uuid) ON DELETE SET NULL,
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
      level_uuid UUID REFERENCES levels(uuid) ON DELETE SET NULL,
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
      level_uuid UUID REFERENCES levels(uuid) ON DELETE SET NULL,
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
      technique_uuid UUID REFERENCES techniques(uuid) ON DELETE CASCADE,
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

// Re-export schema for convenience
export * from "./schema";
