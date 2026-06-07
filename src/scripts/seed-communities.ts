/**
 * Seed script for communities table
 *
 * Reads community data from sudojo_app/docs/communities.md,
 * parses the markdown structure, and inserts records into PostgreSQL
 * using Drizzle ORM.
 *
 * Run with: bun run src/scripts/seed-communities.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { getDb, closeDatabase } from "../db";
import { communities } from "../db/schema";

// ---------------------------------------------------------------------------
// Language name -> code mapping
// ---------------------------------------------------------------------------

const LANGUAGE_MAP: Record<string, string> = {
  English: "en",
  Arabic: "ar",
  German: "de",
  Spanish: "es",
  French: "fr",
  Italian: "it",
  Japanese: "ja",
  Korean: "ko",
  Portuguese: "pt",
  Russian: "ru",
  Swedish: "sv",
  Thai: "th",
  Ukrainian: "uk",
  Vietnamese: "vi",
  "Chinese Simplified": "zh",
  "Chinese Traditional": "zh-hant",
};

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function inferPlatform(header: string, url: string): string {
  const combined = `${header} ${url}`;

  if (/reddit|r\//i.test(combined)) return "reddit";
  if (/discord/i.test(combined)) return "discord";
  if (/facebook/i.test(combined)) return "facebook";
  if (/telegram|t\.me\//i.test(combined)) return "telegram";
  if (/youtube/i.test(combined)) return "youtube";
  if (/whatsapp/i.test(combined)) return "whatsapp";
  if (/forum/i.test(combined)) return "forum";
  if (/daum|cafe/i.test(combined)) return "forum";
  if (/dcinside/i.test(combined)) return "forum";
  if (/pantip/i.test(combined)) return "forum";
  if (/tieba|贴吧/i.test(combined)) return "forum";

  return "website";
}

// ---------------------------------------------------------------------------
// Markdown parser
// ---------------------------------------------------------------------------

interface CommunityEntry {
  language_code: string;
  name: string;
  name_english: string | null;
  description: string;
  url: string;
  platform: string;
  sort_order: number;
}

function parseCommunitiesMarkdown(content: string): CommunityEntry[] {
  const entries: CommunityEntry[] = [];
  const lines = content.split("\n");

  let currentLanguage: string | null = null;
  let currentHeader: string | null = null;
  let currentFields: Record<string, string> = {};
  let sortOrder = 0;

  function flushEntry() {
    if (
      currentLanguage &&
      currentHeader &&
      currentFields["URL"] &&
      currentFields["Name"] &&
      currentFields["Description"]
    ) {
      entries.push({
        language_code: currentLanguage,
        name: currentFields["Name"],
        name_english: currentFields["Name (English)"] || null,
        description: currentFields["Description"],
        url: currentFields["URL"],
        platform: inferPlatform(currentHeader, currentFields["URL"]),
        sort_order: sortOrder,
      });
      sortOrder++;
    }
    currentFields = {};
  }

  for (const line of lines) {
    // Match ## Language headers (e.g., "## English", "## Chinese Simplified")
    const langMatch = line.match(/^## (.+)$/);
    if (langMatch) {
      flushEntry();
      const langName = langMatch[1].trim();
      if (LANGUAGE_MAP[langName]) {
        currentLanguage = LANGUAGE_MAP[langName];
        currentHeader = null;
        sortOrder = 0;
      } else {
        // Skip non-language sections (e.g., "## Table of Contents")
        currentLanguage = null;
      }
      continue;
    }

    // Match ### Community Name headers
    const communityMatch = line.match(/^### (.+)$/);
    if (communityMatch && currentLanguage) {
      flushEntry();
      currentHeader = communityMatch[1].trim();
      continue;
    }

    // Match field lines: - **Key:** Value
    const fieldMatch = line.match(/^- \*\*(.+?):\*\*\s*(.+)$/);
    if (fieldMatch && currentLanguage && currentHeader) {
      const key = fieldMatch[1].trim();
      const value = fieldMatch[2].trim();
      currentFields[key] = value;
    }
  }

  // Flush the last entry
  flushEntry();

  return entries;
}

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function seedCommunities() {
  // Resolve the communities.md path relative to this script's repo sibling
  const mdPath = resolve(
    __dirname,
    "..",
    "..",
    "..",
    "sudojo_app",
    "docs",
    "communities.md"
  );

  console.log(`Reading communities from: ${mdPath}`);
  const content = readFileSync(mdPath, "utf-8");

  const entries = parseCommunitiesMarkdown(content);
  console.log(`Parsed ${entries.length} community entries`);

  const db = getDb();

  let inserted = 0;
  let skipped = 0;

  for (const entry of entries) {
    try {
      const result = await db
        .insert(communities)
        .values({
          language_code: entry.language_code,
          name: entry.name,
          name_english: entry.name_english,
          description: entry.description,
          url: entry.url,
          platform: entry.platform,
          sort_order: entry.sort_order,
        })
        .onConflictDoNothing();

      if (result.length === 0) {
        // onConflictDoNothing returns empty array when row was skipped
        // but postgres-js returns rowCount, so we count either way
        inserted++;
      }
      console.log(
        `  [${entry.language_code}] ${entry.name} (${entry.platform})`
      );
    } catch (error) {
      skipped++;
      console.log(
        `  [${entry.language_code}] Skipped: ${entry.name} - ${error instanceof Error ? error.message : error}`
      );
    }
  }

  console.log(`\nSeeding complete! Inserted: ${inserted}, Skipped: ${skipped}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    await seedCommunities();
  } catch (error) {
    console.error("Error seeding communities:", error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();
