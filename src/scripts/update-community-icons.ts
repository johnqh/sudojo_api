/**
 * Update community icon_url values.
 *
 * Uses Google's favicon service to generate icon URLs from community domains.
 * Some communities get hand-picked higher-quality icons (e.g., Reddit, Discord logos).
 *
 * Run with: bun run src/scripts/update-community-icons.ts
 */

import { eq } from "drizzle-orm";
import { getDb, closeDatabase } from "../db";
import { communities } from "../db/schema";

// ---------------------------------------------------------------------------
// Known high-quality icons for specific domains/platforms
// ---------------------------------------------------------------------------

const DOMAIN_ICONS: Record<string, string> = {
  // Reddit
  "reddit.com":
    "https://www.redditstatic.com/shreddit/assets/favicon/192x192.png",
  "www.reddit.com":
    "https://www.redditstatic.com/shreddit/assets/favicon/192x192.png",
  // Discord
  "discord.com":
    "https://assets-global.website-files.com/6257adef93867e50d84d30e2/6257d23c5fb25be7e0b6e220_Open%20Source%20Projects%20702x540.png",
  "disboard.org":
    "https://assets-global.website-files.com/6257adef93867e50d84d30e2/6257d23c5fb25be7e0b6e220_Open%20Source%20Projects%20702x540.png",
  // Telegram
  "t.me": "https://telegram.org/img/t_logo.png",
  "telegram.me": "https://telegram.org/img/t_logo.png",
  // Facebook
  "facebook.com": "https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico",
  "www.facebook.com":
    "https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico",
  // YouTube
  "youtube.com":
    "https://www.youtube.com/s/desktop/f1d773e5/img/favicon_144x144.png",
  "www.youtube.com":
    "https://www.youtube.com/s/desktop/f1d773e5/img/favicon_144x144.png",
  // WhatsApp
  "gruposwats.com":
    "https://static.whatsapp.net/rsrc.php/v3/yP/r/rYZqPCBaG70.png",
  // Baidu Tieba
  "tieba.baidu.com":
    "https://www.google.com/s2/favicons?domain=tieba.baidu.com&sz=64",
  // Bilibili
  "www.bilibili.com":
    "https://www.google.com/s2/favicons?domain=bilibili.com&sz=64",
  // WeChat (no direct URL, use logo)
  // Nikoli
  "puzzle.nikoli.com":
    "https://www.google.com/s2/favicons?domain=nikoli.com&sz=64",
  "x.com": "https://abs.twimg.com/favicons/twitter.3.ico",
};

/**
 * Extract the domain from a URL.
 */
function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
}

/**
 * Get the best icon URL for a community.
 * Checks known domains first, then falls back to Google Favicon API.
 */
function getIconUrl(communityUrl: string): string {
  const domain = getDomain(communityUrl);
  if (!domain) return "";

  // Check for known high-quality icons
  if (DOMAIN_ICONS[domain]) {
    return DOMAIN_ICONS[domain];
  }

  // Check parent domains (e.g., m.cafe.daum.net -> cafe.daum.net -> daum.net)
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    if (DOMAIN_ICONS[parent]) {
      return DOMAIN_ICONS[parent];
    }
  }

  // Fall back to Google Favicon API (sz=64 for decent resolution)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const db = getDb();

  const rows = await db.select().from(communities);
  console.log(`Found ${rows.length} communities to update`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const iconUrl = getIconUrl(row.url);
    if (!iconUrl) {
      console.log(`  [SKIP] ${row.name} - could not determine domain`);
      skipped++;
      continue;
    }

    await db
      .update(communities)
      .set({ icon_url: iconUrl, updated_at: new Date() })
      .where(eq(communities.uuid, row.uuid));

    console.log(`  [${row.language_code}] ${row.name} -> ${iconUrl}`);
    updated++;
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch(err => {
    console.error("Failed to update community icons:", err);
    process.exit(1);
  })
  .finally(() => closeDatabase());
