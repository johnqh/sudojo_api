import type { z } from "zod";
import type {
  levelCreateSchema,
  levelUpdateSchema,
  techniqueCreateSchema,
  techniqueUpdateSchema,
  learningCreateSchema,
  learningUpdateSchema,
  boardCreateSchema,
  boardUpdateSchema,
  dailyCreateSchema,
  dailyUpdateSchema,
  challengeCreateSchema,
  challengeUpdateSchema,
} from "../schemas";

// =============================================================================
// Entity Types (database models)
// =============================================================================

export interface Level {
  uuid: string;
  index: number;
  title: string;
  text: string;
  requires_subscription: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Technique {
  uuid: string;
  level_uuid: string;
  index: number;
  title: string;
  text: string;
  created_at: Date;
  updated_at: Date;
}

export interface Learning {
  uuid: string;
  technique_uuid: string;
  index: number;
  language_code: string;
  text: string;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Board {
  uuid: string;
  level_uuid: string | null;
  symmetrical: boolean;
  board: string;
  solution: string;
  techniques: number;
  created_at: Date;
  updated_at: Date;
}

export interface Daily {
  uuid: string;
  date: string;
  board_uuid: string | null;
  level_uuid: string | null;
  techniques: number;
  board: string;
  solution: string;
  created_at: Date;
  updated_at: Date;
}

export interface Challenge {
  uuid: string;
  board_uuid: string | null;
  level_uuid: string | null;
  difficulty: number;
  board: string;
  solution: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Request Body Types (derived from Zod schemas)
// =============================================================================

// Level requests
export type LevelCreateRequest = z.infer<typeof levelCreateSchema>;
export type LevelUpdateRequest = z.infer<typeof levelUpdateSchema>;

// Technique requests
export type TechniqueCreateRequest = z.infer<typeof techniqueCreateSchema>;
export type TechniqueUpdateRequest = z.infer<typeof techniqueUpdateSchema>;

// Learning requests
export type LearningCreateRequest = z.infer<typeof learningCreateSchema>;
export type LearningUpdateRequest = z.infer<typeof learningUpdateSchema>;

// Board requests
export type BoardCreateRequest = z.infer<typeof boardCreateSchema>;
export type BoardUpdateRequest = z.infer<typeof boardUpdateSchema>;

// Daily requests
export type DailyCreateRequest = z.infer<typeof dailyCreateSchema>;
export type DailyUpdateRequest = z.infer<typeof dailyUpdateSchema>;

// Challenge requests
export type ChallengeCreateRequest = z.infer<typeof challengeCreateSchema>;
export type ChallengeUpdateRequest = z.infer<typeof challengeUpdateSchema>;

// =============================================================================
// Query Parameter Types
// =============================================================================

export interface TechniqueQueryParams {
  level_uuid?: string;
}

export interface LearningQueryParams {
  technique_uuid?: string;
  language_code?: string;
}

export interface BoardQueryParams {
  level_uuid?: string;
}

export interface ChallengeQueryParams {
  level_uuid?: string;
  difficulty?: string;
}

// =============================================================================
// Response Types
// =============================================================================

// Generic response wrappers
export interface SuccessResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Level responses
export type LevelListResponse = SuccessResponse<Level[]>;
export type LevelResponse = SuccessResponse<Level>;

// Technique responses
export type TechniqueListResponse = SuccessResponse<Technique[]>;
export type TechniqueResponse = SuccessResponse<Technique>;

// Learning responses
export type LearningListResponse = SuccessResponse<Learning[]>;
export type LearningResponse = SuccessResponse<Learning>;

// Board responses
export type BoardListResponse = SuccessResponse<Board[]>;
export type BoardResponse = SuccessResponse<Board>;

// Daily responses
export type DailyListResponse = SuccessResponse<Daily[]>;
export type DailyResponse = SuccessResponse<Daily>;

// Challenge responses
export type ChallengeListResponse = SuccessResponse<Challenge[]>;
export type ChallengeResponse = SuccessResponse<Challenge>;

// Health check response
export interface HealthCheckResponse {
  name: string;
  version: string;
  status: string;
}
