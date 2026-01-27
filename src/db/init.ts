/**
 * Database initialization script
 * Run with: bun run db:init
 */

import { initDatabase, closeDatabase } from "./index";

async function main() {
  console.log("Initializing database...");
  await initDatabase();
  console.log("Database initialized successfully!");
  await closeDatabase();
  process.exit(0);
}

main().catch((error) => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});
