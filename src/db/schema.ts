import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const levels = pgTable("levels", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  index: integer("index").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  text: text("text"),
  requires_subscription: boolean("requires_subscription").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const techniques = pgTable("techniques", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  level_uuid: uuid("level_uuid").references(() => levels.uuid, {
    onDelete: "cascade",
  }),
  index: integer("index").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  text: text("text"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const learning = pgTable("learning", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  technique_uuid: uuid("technique_uuid").references(() => techniques.uuid, {
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
  level_uuid: uuid("level_uuid").references(() => levels.uuid, {
    onDelete: "set null",
  }),
  symmetrical: boolean("symmetrical").default(false),
  board: varchar("board", { length: 81 }).notNull(),
  solution: varchar("solution", { length: 81 }).notNull(),
  techniques: integer("techniques").default(0),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const dailies = pgTable("dailies", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  date: date("date").unique().notNull(),
  board_uuid: uuid("board_uuid").references(() => boards.uuid, {
    onDelete: "set null",
  }),
  level_uuid: uuid("level_uuid").references(() => levels.uuid, {
    onDelete: "set null",
  }),
  techniques: integer("techniques").default(0),
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
  level_uuid: uuid("level_uuid").references(() => levels.uuid, {
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
