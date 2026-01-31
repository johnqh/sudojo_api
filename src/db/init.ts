/**
 * Database initialization script
 * Run with: bun run db:init
 */

import { initDatabase, closeDatabase, initGamificationTables } from "./index";

async function main() {
  console.log("Initializing database...");
  await initDatabase();
  console.log("Core database tables initialized.");

  console.log("Initializing gamification tables...");
  await initGamificationTables();
  console.log("Gamification tables initialized.");

  console.log("Database initialized successfully!");
  await closeDatabase();
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});
