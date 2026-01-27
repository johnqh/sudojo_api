import { z } from "zod";

// Level schemas
export const levelCreateSchema = z.object({
  index: z.number().int(),
  title: z.string().min(1).max(255),
  text: z.string().nullish().default(""),
  requires_subscription: z.boolean().optional().default(false),
});

export const levelUpdateSchema = z.object({
  index: z.number().int().optional(),
  title: z.string().min(1).max(255).optional(),
  text: z.string().nullish(),
  requires_subscription: z.boolean().optional(),
});

// Technique schemas
export const techniqueCreateSchema = z.object({
  level_uuid: z.string().uuid(),
  index: z.number().int(),
  title: z.string().min(1).max(255),
  text: z.string().nullish().default(""),
});

export const techniqueUpdateSchema = z.object({
  level_uuid: z.string().uuid().optional(),
  index: z.number().int().optional(),
  title: z.string().min(1).max(255).optional(),
  text: z.string().nullish(),
});

// Learning schemas
export const learningCreateSchema = z.object({
  technique_uuid: z.string().uuid(),
  index: z.number().int(),
  language_code: z.string().min(2).max(10).nullish().default("en"),
  text: z.string().nullish().default(""),
  image_url: z.string().url().nullish(),
});

export const learningUpdateSchema = z.object({
  technique_uuid: z.string().uuid().optional(),
  index: z.number().int().optional(),
  language_code: z.string().min(2).max(10).nullish(),
  text: z.string().nullish(),
  image_url: z.string().url().nullish(),
});

// Board schemas
export const boardCreateSchema = z.object({
  level_uuid: z.string().uuid().nullish(),
  symmetrical: z.boolean().optional().default(false),
  board: z.string().length(81),
  solution: z.string().length(81),
  techniques: z.number().int().optional().default(0),
});

export const boardUpdateSchema = z.object({
  level_uuid: z.string().uuid().nullish(),
  symmetrical: z.boolean().optional(),
  board: z.string().length(81).optional(),
  solution: z.string().length(81).optional(),
  techniques: z.number().int().optional(),
});

// Daily schemas
export const dailyCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  board_uuid: z.string().uuid().nullish(),
  level_uuid: z.string().uuid().nullish(),
  techniques: z.number().int().optional().default(0),
  board: z.string().length(81),
  solution: z.string().length(81),
});

export const dailyUpdateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  board_uuid: z.string().uuid().nullish(),
  level_uuid: z.string().uuid().nullish(),
  techniques: z.number().int().optional(),
  board: z.string().length(81).optional(),
  solution: z.string().length(81).optional(),
});

// Challenge schemas
export const challengeCreateSchema = z.object({
  board_uuid: z.string().uuid().nullish(),
  level_uuid: z.string().uuid().nullish(),
  difficulty: z.number().int().min(1).max(10).optional().default(1),
  board: z.string().length(81),
  solution: z.string().length(81),
});

export const challengeUpdateSchema = z.object({
  board_uuid: z.string().uuid().nullish(),
  level_uuid: z.string().uuid().nullish(),
  difficulty: z.number().int().min(1).max(10).optional(),
  board: z.string().length(81).optional(),
  solution: z.string().length(81).optional(),
});

// UUID param schema
export const uuidParamSchema = z.object({
  uuid: z.string().uuid(),
});

export const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// User param schema (Firebase user IDs are typically 28 characters)
export const userIdParamSchema = z.object({
  userId: z.string().min(1).max(128),
});

// Technique example schemas
export const techniqueExampleCreateSchema = z.object({
  board: z.string().length(81),
  pencilmarks: z.string().nullish(),
  solution: z.string().length(81),
  techniques_bitfield: z.number().int().min(1),
  primary_technique: z.number().int().min(1).max(23),
  hint_data: z.string().nullish(),
  source_board_uuid: z.string().uuid().nullish(),
});

export const techniqueExampleUpdateSchema = z.object({
  board: z.string().length(81).optional(),
  pencilmarks: z.string().nullish(),
  solution: z.string().length(81).optional(),
  techniques_bitfield: z.number().int().min(1).optional(),
  primary_technique: z.number().int().min(1).max(23).optional(),
  hint_data: z.string().nullish(),
  source_board_uuid: z.string().uuid().nullish(),
});
