import { db, initDatabase, levels, techniques, learning, boards, dailies, challenges } from "../src/db";

export const API_TOKEN = "dev-secret-token-12345";

export async function setupTestDatabase() {
  await initDatabase();
  // Clean up tables for fresh test runs
  await db.delete(learning);
  await db.delete(techniques);
  await db.delete(dailies);
  await db.delete(challenges);
  await db.delete(boards);
  await db.delete(levels);
}

export async function cleanupTestDatabase() {
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
export const sampleBoard = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
export const sampleSolution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
