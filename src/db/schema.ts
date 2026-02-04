import {
  pgTable,
  uuid,
  integer,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createRateLimitCountersTablePublic } from "@sudobility/ratelimit_service";

export const levels = pgTable("levels", {
  level: integer("level").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  text: text("text"),
  requires_subscription: boolean("requires_subscription").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const techniques = pgTable("techniques", {
  technique: integer("technique").primaryKey(),
  level: integer("level").references(() => levels.level, {
    onDelete: "cascade",
  }),
  title: varchar("title", { length: 255 }).notNull(),
  path: varchar("path", { length: 255 }),
  dependencies: text("dependencies"),
  text: text("text"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => ({
  pathIdx: index("techniques_path_idx").on(table.path),
}));

export const learning = pgTable("learning", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  technique: integer("technique").references(() => techniques.technique, {
    onDelete: "cascade",
  }),
  index: integer("index").notNull(),
  language_code: varchar("language_code", { length: 10 })
    .notNull()
    .default("en"),
  text: text("text"),
  image_url: text("image_url"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const boards = pgTable("boards", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  level: integer("level").references(() => levels.level, {
    onDelete: "set null",
  }),
  symmetrical: boolean("symmetrical").default(false),
  board: varchar("board", { length: 81 }).notNull(),
  solution: varchar("solution", { length: 81 }).notNull(),
  techniques: bigint("techniques", { mode: "number" }).default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const dailies = pgTable("dailies", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  date: date("date").unique().notNull(),
  board_uuid: uuid("board_uuid").references(() => boards.uuid, {
    onDelete: "set null",
  }),
  level: integer("level").references(() => levels.level, {
    onDelete: "set null",
  }),
  techniques: bigint("techniques", { mode: "number" }).default(0),
  board: varchar("board", { length: 81 }).notNull(),
  solution: varchar("solution", { length: 81 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const challenges = pgTable("challenges", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  board_uuid: uuid("board_uuid").references(() => boards.uuid, {
    onDelete: "set null",
  }),
  level: integer("level").references(() => levels.level, {
    onDelete: "set null",
  }),
  difficulty: integer("difficulty").default(1),
  board: varchar("board", { length: 81 }).notNull(),
  solution: varchar("solution", { length: 81 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const accessLogs = pgTable("access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: varchar("user_id", { length: 128 }).notNull(),
  endpoint: varchar("endpoint", { length: 50 }).notNull(),
  access_date: date("access_date").notNull(),
  created_at: timestamp("created_at").defaultNow(),
});

// =============================================================================
// Technique Examples Table (for tutorials)
// =============================================================================

export const techniqueExamples = pgTable("technique_examples", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  /** Board state (current position, not original puzzle) */
  board: varchar("board", { length: 81 }).notNull(),
  /** Pencilmarks at this state (comma-delimited) */
  pencilmarks: text("pencilmarks"),
  /** Solution for reference */
  solution: varchar("solution", { length: 81 }).notNull(),
  /** Bitfield of ALL techniques applicable at this board state */
  techniques_bitfield: bigint("techniques_bitfield", { mode: "number" }).notNull(),
  /** Primary technique (the one solver would use first) */
  primary_technique: integer("primary_technique").notNull(),
  /** Hint data (JSON with areas, cells, description) */
  hint_data: text("hint_data"),
  /** Source board UUID (optional, for reference) */
  source_board_uuid: uuid("source_board_uuid").references(() => boards.uuid, {
    onDelete: "set null",
  }),
  created_at: timestamp("created_at").defaultNow(),
});

// =============================================================================
// Technique Practices Table (for practice mode)
// =============================================================================

export const techniquePractices = pgTable("technique_practices", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  /** Reference to the technique this practice is for */
  technique: integer("technique").references(() => techniques.technique, {
    onDelete: "cascade",
  }),
  /** Board state (merged user input into original - looks like fresh puzzle) */
  board: varchar("board", { length: 81 }).notNull(),
  /** Pencilmarks at this state (comma-delimited) */
  pencilmarks: text("pencilmarks"),
  /** Solution for reference */
  solution: varchar("solution", { length: 81 }).notNull(),
  /** Hint data (JSON with areas, cells, description) */
  hint_data: text("hint_data"),
  /** Source example UUID (optional, for reference) */
  source_example_uuid: uuid("source_example_uuid").references(
    () => techniqueExamples.uuid,
    {
      onDelete: "set null",
    }
  ),
  created_at: timestamp("created_at").defaultNow(),
});

// =============================================================================
// Gamification Tables
// =============================================================================

/** User gamification stats - total points, level, games completed */
export const userStats = pgTable("user_stats", {
  userId: varchar("user_id", { length: 128 }).primaryKey(),
  totalPoints: bigint("total_points", { mode: "number" }).notNull().default(0),
  userLevel: integer("user_level").notNull().default(0),
  gamesCompleted: integer("games_completed").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Badge definitions - flexible badge system with types and requirements */
export const badgeDefinitions = pgTable("badge_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  badgeType: varchar("badge_type", { length: 50 }).notNull(), // 'level_mastery', 'games_played', etc.
  badgeKey: varchar("badge_key", { length: 100 }).unique().notNull(), // 'level_1', 'games_100', etc.
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  iconUrl: varchar("icon_url", { length: 500 }),
  requirementValue: integer("requirement_value"), // e.g., level 5, or 100 games
  createdAt: timestamp("created_at").defaultNow(),
});

/** User earned badges */
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 128 }).notNull(),
    badgeKey: varchar("badge_key", { length: 100 })
      .notNull()
      .references(() => badgeDefinitions.badgeKey),
    earnedAt: timestamp("earned_at").defaultNow(),
  },
  table => ({
    uniqueUserBadge: unique().on(table.userId, table.badgeKey),
  })
);

/** Active game session - one per user, tracks current game state */
export const gameSessions = pgTable("game_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 128 }).unique().notNull(), // UNIQUE enforces one active session per user
  board: varchar("board", { length: 81 }).notNull(),
  solution: varchar("solution", { length: 81 }).notNull(),
  level: integer("level").notNull(),
  techniques: bigint("techniques", { mode: "number" }).default(0),
  hintUsed: boolean("hint_used").notNull().default(false),
  hintsCount: integer("hints_count").notNull().default(0),
  hintPointsEarned: integer("hint_points_earned").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  puzzleType: varchar("puzzle_type", { length: 20 }).notNull(), // 'daily', 'level'
  puzzleId: varchar("puzzle_id", { length: 100 }), // date for daily, uuid for level
});

/** Point transaction history - audit trail for all point changes */
export const pointTransactions = pgTable("point_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  points: integer("points").notNull(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'puzzle_complete', 'hint_used'
  metadata: jsonb("metadata"), // {level, puzzle_type, multipliers, etc.}
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================================================
// Rate Limit Counters Table (from @sudobility/subscription_service)
// =============================================================================

export const rateLimitCounters = createRateLimitCountersTablePublic("sudojo");
