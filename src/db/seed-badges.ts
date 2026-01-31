/**
 * Seed script for badge definitions
 * Run with: bun run src/db/seed-badges.ts
 */

import { getDb, closeDatabase } from "./index";
import { badgeDefinitions } from "./schema";

// Belt names for levels 1-12
const BELT_NAMES = [
  "White Belt",
  "White Belt (Yellow Stripe)",
  "Yellow Belt",
  "Yellow Belt (Orange Stripe)",
  "Orange Belt",
  "Orange Belt (Green Stripe)",
  "Green Belt",
  "Green Belt (Blue Stripe)",
  "Blue Belt",
  "Blue Belt (Brown Stripe)",
  "Brown Belt",
  "Black Belt",
];

// Games-played milestone names
const GAMES_MILESTONES: Array<{ count: number; title: string; description: string }> = [
  { count: 5, title: "Getting Started", description: "Complete 5 puzzles" },
  { count: 10, title: "Warming Up", description: "Complete 10 puzzles" },
  { count: 25, title: "Apprentice", description: "Complete 25 puzzles" },
  { count: 50, title: "Dedicated", description: "Complete 50 puzzles" },
  { count: 100, title: "Centurion", description: "Complete 100 puzzles" },
  { count: 200, title: "Enthusiast", description: "Complete 200 puzzles" },
  { count: 500, title: "Expert", description: "Complete 500 puzzles" },
  { count: 1000, title: "Master", description: "Complete 1000 puzzles" },
  { count: 2000, title: "Grandmaster", description: "Complete 2000 puzzles" },
  { count: 5000, title: "Legend", description: "Complete 5000 puzzles" },
  { count: 10000, title: "Immortal", description: "Complete 10000 puzzles" },
];

async function seedBadges() {
  const db = getDb();

  console.log("Seeding badge definitions...");

  // Level mastery badges
  for (let level = 1; level <= 12; level++) {
    const beltName = BELT_NAMES[level - 1];
    try {
      await db
        .insert(badgeDefinitions)
        .values({
          badgeType: "level_mastery",
          badgeKey: `level_${level}`,
          title: beltName,
          description: `Complete a Level ${level} puzzle without hints or interruptions`,
          requirementValue: level,
        })
        .onConflictDoNothing();
      console.log(`  Created badge: level_${level} (${beltName})`);
    } catch (_error) {
      console.log(`  Badge level_${level} already exists, skipping...`);
    }
  }

  // Games-played badges
  for (const milestone of GAMES_MILESTONES) {
    try {
      await db
        .insert(badgeDefinitions)
        .values({
          badgeType: "games_played",
          badgeKey: `games_${milestone.count}`,
          title: milestone.title,
          description: milestone.description,
          requirementValue: milestone.count,
        })
        .onConflictDoNothing();
      console.log(`  Created badge: games_${milestone.count} (${milestone.title})`);
    } catch (_error) {
      console.log(`  Badge games_${milestone.count} already exists, skipping...`);
    }
  }

  console.log("Badge seeding complete!");
}

async function main() {
  try {
    await seedBadges();
  } catch (error) {
    console.error("Error seeding badges:", error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
