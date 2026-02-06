/**
 * Script to clear technique_examples and technique_practices tables.
 * Run with: bun run scripts/clear-examples-practices.ts
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

async function main() {
  const client = postgres(DATABASE_URL!);

  try {
    console.log("Clearing technique_practices...");
    const practicesResult = await client`TRUNCATE technique_practices CASCADE`;
    console.log("technique_practices cleared");

    console.log("Clearing technique_examples...");
    const examplesResult = await client`TRUNCATE technique_examples CASCADE`;
    console.log("technique_examples cleared");

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
