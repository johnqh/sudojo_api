import { sql, initDatabase } from "../src/db";

export const API_TOKEN = "dev-secret-token-12345";

export async function setupTestDatabase() {
  await initDatabase();
  // Clean up tables for fresh test runs
  await sql`TRUNCATE TABLE learning CASCADE`;
  await sql`TRUNCATE TABLE techniques CASCADE`;
  await sql`TRUNCATE TABLE dailies CASCADE`;
  await sql`TRUNCATE TABLE challenges CASCADE`;
  await sql`TRUNCATE TABLE boards CASCADE`;
  await sql`TRUNCATE TABLE levels CASCADE`;
}

export async function cleanupTestDatabase() {
  await sql`TRUNCATE TABLE learning CASCADE`;
  await sql`TRUNCATE TABLE techniques CASCADE`;
  await sql`TRUNCATE TABLE dailies CASCADE`;
  await sql`TRUNCATE TABLE challenges CASCADE`;
  await sql`TRUNCATE TABLE boards CASCADE`;
  await sql`TRUNCATE TABLE levels CASCADE`;
}

export async function closeTestDatabase() {
  await sql.end();
}

// Sample test data
export const sampleBoard = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
export const sampleSolution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
