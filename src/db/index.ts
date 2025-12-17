import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getRequiredEnv } from "../lib/env-helper";

const connectionString = getRequiredEnv("DATABASE_URL");

const client = postgres(connectionString);
export const db = drizzle(client, { schema });

export async function initDatabase() {
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
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, endpoint, access_date)
    )
  `;

  console.log("Database tables initialized");
}

export async function closeDatabase() {
  await client.end();
}

// Re-export schema for convenience
export * from "./schema";
