import { z } from "zod";

// Level schemas
export const levelCreateSchema = z.object({
  index: z.number().int(),
  title: z.string().min(1).max(255),
  text: z.string().optional().default(""),
  requires_subscription: z.boolean().optional().default(false),
});

export const levelUpdateSchema = z.object({
  index: z.number().int().optional(),
  title: z.string().min(1).max(255).optional(),
  text: z.string().optional(),
  requires_subscription: z.boolean().optional(),
});

// Technique schemas
export const techniqueCreateSchema = z.object({
  level_uuid: z.string().uuid(),
  index: z.number().int(),
  title: z.string().min(1).max(255),
  text: z.string().optional().default(""),
});

export const techniqueUpdateSchema = z.object({
  level_uuid: z.string().uuid().optional(),
  index: z.number().int().optional(),
  title: z.string().min(1).max(255).optional(),
  text: z.string().optional(),
});

// Learning schemas
export const learningCreateSchema = z.object({
  technique_uuid: z.string().uuid(),
  index: z.number().int(),
  language_code: z.string().min(2).max(10).optional().default("en"),
  text: z.string().optional().default(""),
  image_url: z.string().url().nullable().optional(),
});

export const learningUpdateSchema = z.object({
  technique_uuid: z.string().uuid().optional(),
  index: z.number().int().optional(),
  language_code: z.string().min(2).max(10).optional(),
  text: z.string().optional(),
  image_url: z.string().url().nullable().optional(),
});

// Board schemas
export const boardCreateSchema = z.object({
  level_uuid: z.string().uuid().nullable().optional(),
  symmetrical: z.boolean().optional().default(false),
  board: z.string().length(81),
  solution: z.string().length(81),
  techniques: z.number().int().optional().default(0),
});

export const boardUpdateSchema = z.object({
  level_uuid: z.string().uuid().nullable().optional(),
  symmetrical: z.boolean().optional(),
  board: z.string().length(81).optional(),
  solution: z.string().length(81).optional(),
  techniques: z.number().int().optional(),
});

// Daily schemas
export const dailyCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  board_uuid: z.string().uuid().nullable().optional(),
  level_uuid: z.string().uuid().nullable().optional(),
  techniques: z.number().int().optional().default(0),
  board: z.string().length(81),
  solution: z.string().length(81),
});

export const dailyUpdateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  board_uuid: z.string().uuid().nullable().optional(),
  level_uuid: z.string().uuid().nullable().optional(),
  techniques: z.number().int().optional(),
  board: z.string().length(81).optional(),
  solution: z.string().length(81).optional(),
});

// Challenge schemas
export const challengeCreateSchema = z.object({
  board_uuid: z.string().uuid().nullable().optional(),
  level_uuid: z.string().uuid().nullable().optional(),
  difficulty: z.number().int().min(1).max(10).optional().default(1),
  board: z.string().length(81),
  solution: z.string().length(81),
});

export const challengeUpdateSchema = z.object({
  board_uuid: z.string().uuid().nullable().optional(),
  level_uuid: z.string().uuid().nullable().optional(),
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
