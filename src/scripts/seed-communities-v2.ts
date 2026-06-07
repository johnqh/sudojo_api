/**
 * Seed script v2 - Add newly discovered communities.
 *
 * Run with: bun run src/scripts/seed-communities-v2.ts
 */

import { getDb, closeDatabase } from "../db";
import { communities } from "../db/schema";

interface CommunityEntry {
  language_code: string;
  name: string;
  name_english: string | null;
  description: string;
  url: string;
  platform: string;
}

const NEW_COMMUNITIES: CommunityEntry[] = [
  // ===================== ENGLISH (en) =====================
  {
    language_code: "en",
    name: "Sudoku Solvers (BremSter's Discord)",
    name_english: null,
    description:
      "Community run by BremSter (YouTube puzzle solver); discussion of solves, technique sharing, puzzle submissions.",
    url: "https://discord.com/invite/AEhpTG4z45",
    platform: "discord",
  },
  {
    language_code: "en",
    name: "sudoku.coach Discord",
    name_english: null,
    description:
      "3,262 members; community for the sudoku.coach web app — learning techniques, sharing puzzles, discussing strategies.",
    url: "https://discord.com/invite/p2YKqXrktA",
    platform: "discord",
  },
  {
    language_code: "en",
    name: "WPF - World Puzzle Federation Discord",
    name_english: null,
    description:
      "Official WPF Discord server for Grand Prix discussion, championship chat, and international puzzle community.",
    url: "https://discord.com/invite/NM9xn6Rm9k",
    platform: "discord",
  },
  {
    language_code: "en",
    name: "GMPuzzles",
    name_english: null,
    description:
      "Grandmaster Puzzles community by Thomas Snyder (3x World Sudoku Champion); daily logic puzzles and competition-grade content.",
    url: "https://gmpuzzles.com/",
    platform: "website",
  },
  {
    language_code: "en",
    name: "Puzzle Baron Sudoku Forum",
    name_english: null,
    description:
      "Part of the Puzzle Baron network (6M+ users/year since 2006); monthly competitions with leaderboards.",
    url: "https://forum.puzzlebaron.com/forum/puzzle-baron/sudoku",
    platform: "forum",
  },
  {
    language_code: "en",
    name: "Sudoku Exchange",
    name_english: null,
    description:
      "Ad-free platform for solving and sharing Sudoku puzzles with a hint system explaining the logic behind each step.",
    url: "https://sudokuexchange.com/",
    platform: "website",
  },
  {
    language_code: "en",
    name: "Twitch Sudoku Category",
    name_english: null,
    description:
      "Active streaming category with 26K+ hours watched; live solvers, speedruns, and interactive puzzle streams.",
    url: "https://www.twitch.tv/directory/game/Sudoku",
    platform: "website",
  },
  {
    language_code: "en",
    name: "SudokuPad Steam Community",
    name_english: null,
    description:
      "Discussion forum for the SudokuPad app (used by Cracking the Cryptic); puzzle sharing and variant discussion.",
    url: "https://steamcommunity.com/app/1706870/discussions/",
    platform: "forum",
  },
  {
    language_code: "en",
    name: "Sudoku Australia",
    name_english: null,
    description:
      "WPF Australian affiliate promoting competitive sudoku at state, national, and international levels.",
    url: "https://www.sudokuaustralia.com/",
    platform: "website",
  },
  {
    language_code: "en",
    name: "US Puzzle & Sudoku Championships",
    name_english: null,
    description:
      "US team selection for World Puzzle/Sudoku Championships; annual USPC and qualifying competitions.",
    url: "https://wpc.puzzles.com/",
    platform: "website",
  },
  {
    language_code: "en",
    name: "@sudokuplayers (Telegram)",
    name_english: null,
    description:
      "Friendly puzzle group; solve, chat, and grow with players from around the world, beginners and pros.",
    url: "https://t.me/sudokuplayers",
    platform: "telegram",
  },
  {
    language_code: "en",
    name: "SudokuSlash",
    name_english: null,
    description:
      "Live battles against real players with instant matchmaking, tournaments, and rankings.",
    url: "https://sudokuslash.com/",
    platform: "website",
  },

  // ===================== SPANISH (es) =====================
  {
    language_code: "es",
    name: "Dave T",
    name_english: "Dave T (YouTube)",
    description:
      "Canal de YouTube en español con los mejores tutoriales para aprender a resolver Sudoku, desde fácil a difícil.",
    url: "https://www.youtube.com/@DaveTT",
    platform: "youtube",
  },
  {
    language_code: "es",
    name: "ePasatiempos.es",
    name_english: "ePuzzles",
    description:
      "Portal español de pasatiempos gratuitos con sudokus, crucigramas, sopas de letras, y un foro de sudoku con métodos de resolución.",
    url: "https://www.epasatiempos.es/sudokus.php",
    platform: "website",
  },

  // ===================== PORTUGUESE (pt) =====================
  {
    language_code: "pt",
    name: "Racha Cuca",
    name_english: "Brain Crack",
    description:
      "Portal brasileiro de entretenimento inteligente com sudoku, problemas de lógica, quizzes e quebra-cabeças. Facebook com 229 mil curtidas.",
    url: "https://rachacuca.com.br/logica/sudoku/",
    platform: "website",
  },
  {
    language_code: "pt",
    name: "Geniol",
    name_english: "Geniol - Games for Smart People",
    description:
      "Site brasileiro dedicado a exercitar o cérebro com jogos e passatempos, incluindo sudoku em cinco níveis de dificuldade e variantes.",
    url: "https://www.geniol.com.br/logica/sudoku/",
    platform: "website",
  },
  {
    language_code: "pt",
    name: "SUPERA - Ginástica para o Cérebro",
    name_english: "SUPERA - Brain Gymnastics",
    description:
      "A maior rede de estimulação cognitiva da América Latina com mais de 250 unidades no Brasil. Organiza o Campeonato Nacional de Sudoku.",
    url: "https://metodosupera.com.br/sudoku/",
    platform: "website",
  },
  {
    language_code: "pt",
    name: "Observador Jogos - Sudoku",
    name_english: null,
    description:
      "Jornal português que oferece três novos níveis de sudoku por dia (fácil, médio, difícil).",
    url: "https://observador.pt/jogos/sudoku/",
    platform: "website",
  },

  // ===================== ITALIAN (it) =====================
  {
    language_code: "it",
    name: "Il Forum dei Solutori",
    name_english: "The Solvers' Forum",
    description:
      "Forum storico italiano per appassionati di enigmistica con 2.872.315 messaggi, 57.877 discussioni e 12.593 utenti. Include sezioni per sudoku, rebus, cruciverba.",
    url: "https://oedipower.aenigmatica.eu/",
    platform: "forum",
  },
  {
    language_code: "it",
    name: "Enigmatici Indipendenti",
    name_english: "Independent Puzzle Makers",
    description:
      "Forum italiano di sfide di enigmistica e giochi per tutta la settimana. 182.186 post, 8.755 discussioni, 894 membri con competizioni settimanali.",
    url: "https://enigmaticiindipendenti.forumfree.it/",
    platform: "forum",
  },
  {
    language_code: "it",
    name: "nonzero (editore di Settimana Sudoku)",
    name_english: "nonzero (Settimana Sudoku publisher)",
    description:
      "Prima società editoriale italiana a pubblicare una rivista di sudoku in Italia (dal 2005). Membro della World Puzzle Federation. Organizza i Campionati Italiani.",
    url: "https://www.nonzero.it/",
    platform: "website",
  },
  {
    language_code: "it",
    name: "UISP - Campionato Italiano di Sudoku",
    name_english: "UISP - Italian Sudoku Championship",
    description:
      "La UISP organizza il Campionato Italiano di Sudoku a Modena durante il festival 'Play'. Qualificazioni con sudoku classici e varianti.",
    url: "https://www.uisp.it/giochitradizionali2/pagina/campionato-italiano-di-sudoku",
    platform: "website",
  },

  // ===================== JAPANESE (ja) =====================
  {
    language_code: "ja",
    name: "Puzsq Meets Discord",
    name_english: "Puzzle Square Meets Discord",
    description:
      "Puzzle Square JP公式のDiscordサーバー。ペンシルパズル（数独含む）について日本語で交流。292人以上のメンバー。",
    url: "https://puzsq.logicpuzzle.app/campaign/puzsq-meets",
    platform: "discord",
  },
  {
    language_code: "ja",
    name: "一般社団法人日本数独協会",
    name_english: "Japan Sudoku Association",
    description:
      "数独の父・鍜治真起氏が設立した公式数独協会。月例パズルチャレンジ、解法研究、リモート・対面イベントを実施。",
    url: "https://sudokujapan.com/",
    platform: "website",
  },
  {
    language_code: "ja",
    name: "株式会社ニコリ YouTube",
    name_english: "Nikoli Inc. Official YouTube",
    description:
      "ニコリ公式チャンネル。数独の解き方（初級・中級・上級）、数独の作り方の動画を公開。",
    url: "https://www.youtube.com/channel/UCzqhN6W4PtsuEP0RwYFoudQ",
    platform: "youtube",
  },
  {
    language_code: "ja",
    name: "ナンプレ 眺めて解こう",
    name_english: "Nanpure - Solve by Looking",
    description:
      "候補数字を書かずに「眺めて」解く技法を紹介するブログ。SE9～11レベルの超難問の解法を実例付きで解説。",
    url: "https://note.com/numpl_npm/all",
    platform: "website",
  },

  // ===================== KOREAN (ko) =====================
  {
    language_code: "ko",
    name: "더스도쿠",
    name_english: "TheSudoku",
    description:
      "서울에서 디자인 및 제작된 아날로그 스도쿠 제품 브랜드. 7개국 수출. Instagram과 Threads에서 커뮤니티 활동.",
    url: "https://thesudoku.io/",
    platform: "website",
  },
  {
    language_code: "ko",
    name: "퍼즐코리아",
    name_english: "Puzzle Korea",
    description:
      "한국의 대표적인 퍼즐 전문 사이트. '퍼즐의 명품'을 표방하는 퍼즐 커뮤니티.",
    url: "http://www.puzzlekorea.com/",
    platform: "website",
  },

  // ===================== CHINESE SIMPLIFIED (zh) =====================
  {
    language_code: "zh",
    name: "变型数独",
    name_english: "Variant Sudoku Top",
    description:
      "100+种变型数独在线解题平台。每日更新，数独Wiki建设中，含教学资源和比赛信息。",
    url: "https://variantsudoku.top/",
    platform: "website",
  },
  {
    language_code: "zh",
    name: "数独资源与分类",
    name_english: "Sudoku Resources & Classification",
    description:
      "全面的数独资源知识库。收录数独网站、微信公众号、博客、比赛信息等的分类整理，支持GitBook知识图谱。",
    url: "https://zhugelianglongming.github.io/sudoku/",
    platform: "website",
  },
  {
    language_code: "zh",
    name: "剑客玩变型数独",
    name_english: "Swordsman Plays Variant Sudoku",
    description:
      "B站数独UP主，分享世锦赛赛题、直观标准数独系列、变型数独等内容。QQ群885087250为粉丝交流群。",
    url: "https://space.bilibili.com/1455861172",
    platform: "website",
  },
  {
    language_code: "zh",
    name: "抖音 #数独",
    name_english: "Douyin Sudoku",
    description:
      "抖音上活跃的数独教学内容生态。包括入门教程、解题挑战、直播间解题等，多位知名创作者参与。",
    url: "https://www.douyin.com/search/%E6%95%B0%E7%8B%AC",
    platform: "website",
  },

  // ===================== CHINESE TRADITIONAL (zh-hant) =====================
  {
    language_code: "zh-hant",
    name: "全港少年數多酷大賽",
    name_english: "Hong Kong Youth Sudoku Championship",
    description:
      "曹宏威教授主導的數獨教育社群。HKU SPACE開設速成班課程，年度全港青少年比賽已辦至第九屆，近百所學校參與。",
    url: "https://hkuspace.hku.hk/prog/teaching-sudoku-to-children-speed-up-course",
    platform: "website",
  },

  // ===================== RUSSIAN (ru) =====================
  {
    language_code: "ru",
    name: "4PDA Форум - Судоку",
    name_english: "4PDA Forum - Sudoku",
    description:
      "Крупнейший русскоязычный форум по мобильным устройствам. Множество активных тем о судоку-приложениях с обсуждениями.",
    url: "https://4pda.to/forum/index.php?showtopic=272270",
    platform: "forum",
  },
  {
    language_code: "ru",
    name: "OnSudoku",
    name_english: "OnSudoku",
    description:
      "Бесплатная платформа для судоку с 5 уровнями сложности, рейтинговой системой (22,000+ игроков) и стриками. Более 58 миллионов решённых головоломок.",
    url: "https://onsudoku.com/",
    platform: "website",
  },
  {
    language_code: "ru",
    name: "Forsmarts",
    name_english: "Forsmarts - Logic Games and Puzzles",
    description:
      "Сайт с логическими головоломками, включая судоку. Проводит сезонные соревнования с рейтингами. Связан с чемпионатом Беларуси.",
    url: "https://www.forsmarts.com/",
    platform: "website",
  },

  // ===================== SWEDISH (sv) =====================
  {
    language_code: "sv",
    name: "Tankesport",
    name_english: "Tankesport - Sudoku Online and Competitions",
    description:
      "Sveriges ledande förlag för korsord och sudoku. Erbjuder dagliga sudoku online, tidningen 'Allt om Sudoku' och digitala tävlingar med priser.",
    url: "https://www.tankesport.se/sudoku-online",
    platform: "website",
  },

  // ===================== THAI (th) =====================
  {
    language_code: "th",
    name: "RoygbivPuzzles",
    name_english: "Somewhere Over the Rainbow - Uniting Puzzle People",
    description:
      "บล็อกปริศนาจากชุมชนนักไขปริศนาไทย จัดงาน Thailand Sudoku Championship 2025 และเตรียมจัด Asian Sudoku Championship 2026 ที่กรุงเทพ",
    url: "https://roygbivpuzzles.wordpress.com/",
    platform: "website",
  },

  // ===================== UKRAINIAN (uk) =====================
  {
    language_code: "uk",
    name: "DAY TODAY - Щоденні онлайн головоломки",
    name_english: "DAY TODAY - Daily Online Puzzles",
    description:
      "Український портал з щоденними головоломками: судоку (3 рівні складності), кросворди, Словодій. Нові задачі щодня.",
    url: "https://daytoday.ua/golovolomky/",
    platform: "website",
  },
  {
    language_code: "uk",
    name: "Escape Sudoku",
    name_english: "Escape Sudoku",
    description:
      "Українська платформа для судоку з блогом, щоденними головоломками, стратегіями та техніками розв'язання.",
    url: "https://escape-sudoku.com/",
    platform: "website",
  },

  // ===================== ARABIC (ar) =====================
  {
    language_code: "ar",
    name: "سودوكو للفنون",
    name_english: "Sudoku for Arts",
    description:
      "فريق فني مصري بقيادة أحمد رجائي يستخدم السودوكو والفنون لتنمية المجتمع. القاهرة، مصر. 5,380 إعجاب على فيسبوك.",
    url: "https://www.facebook.com/SudokuTeam/",
    platform: "facebook",
  },
  {
    language_code: "ar",
    name: "سودوكو - الشرق الأوسط",
    name_english: "Asharq Al-Awsat Sudoku",
    description:
      "قسم الألعاب في جريدة الشرق الأوسط الدولية. تحديات سودوكو يومية بمستويات مختلفة لتدريب التفكير المنطقي.",
    url: "https://aawsat.com/",
    platform: "website",
  },
];

// ---------------------------------------------------------------------------

function getIconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    const KNOWN: Record<string, string> = {
      "discord.com":
        "https://assets-global.website-files.com/6257adef93867e50d84d30e2/6257d23c5fb25be7e0b6e220_Open%20Source%20Projects%20702x540.png",
      "t.me": "https://telegram.org/img/t_logo.png",
      "www.facebook.com":
        "https://static.xx.fbcdn.net/rsrc.php/yb/r/hLRJ1GG_y0J.ico",
      "www.youtube.com":
        "https://www.youtube.com/s/desktop/f1d773e5/img/favicon_144x144.png",
      "www.twitch.tv":
        "https://www.google.com/s2/favicons?domain=twitch.tv&sz=64",
      "steamcommunity.com":
        "https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=64",
    };
    if (KNOWN[domain]) return KNOWN[domain];
    // Check parent domains
    const parts = domain.split(".");
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join(".");
      if (KNOWN[parent]) return KNOWN[parent];
    }
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const db = getDb();

  // Get max sort_order per language
  const existing = await db.select().from(communities);
  const maxOrder = new Map<string, number>();
  for (const row of existing) {
    const curr = maxOrder.get(row.language_code) ?? -1;
    if ((row.sort_order ?? 0) > curr)
      maxOrder.set(row.language_code, row.sort_order ?? 0);
  }

  // Check for duplicates by URL
  const existingUrls = new Set(existing.map(r => r.url));

  console.log(`Adding ${NEW_COMMUNITIES.length} new communities...`);
  let inserted = 0;
  let skipped = 0;

  for (const entry of NEW_COMMUNITIES) {
    if (existingUrls.has(entry.url)) {
      console.log(`  [SKIP] ${entry.name} — URL already exists`);
      skipped++;
      continue;
    }

    const sortOrder = (maxOrder.get(entry.language_code) ?? -1) + 1;
    maxOrder.set(entry.language_code, sortOrder);

    const iconUrl = getIconUrl(entry.url);

    await db.insert(communities).values({
      language_code: entry.language_code,
      name: entry.name,
      name_english: entry.name_english,
      description: entry.description,
      url: entry.url,
      platform: entry.platform,
      sort_order: sortOrder,
      icon_url: iconUrl || null,
    });

    console.log(`  [${entry.language_code}] ${entry.name} (${entry.platform})`);
    inserted++;
    existingUrls.add(entry.url);
  }

  console.log(`\nDone! Inserted: ${inserted}, Skipped: ${skipped}`);
}

main()
  .catch(err => {
    console.error("Failed:", err);
    process.exit(1);
  })
  .finally(() => closeDatabase());
