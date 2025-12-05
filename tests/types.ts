// Type helpers for tests
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface LevelData {
  uuid: string;
  index: number;
  title: string;
  text: string;
  requires_subscription: boolean;
}

export interface TechniqueData {
  uuid: string;
  level_uuid: string;
  index: number;
  title: string;
  text: string;
}

export interface LearningData {
  uuid: string;
  technique_uuid: string;
  index: number;
  language_code: string;
  text: string;
  image_url: string | null;
}

export interface BoardData {
  uuid: string;
  level_uuid: string | null;
  symmetrical: boolean;
  board: string;
  solution: string;
  techniques: number;
}

export interface DailyData {
  uuid: string;
  date: string;
  board_uuid: string | null;
  level_uuid: string | null;
  techniques: number;
  board: string;
  solution: string;
}

export interface ChallengeData {
  uuid: string;
  board_uuid: string | null;
  level_uuid: string | null;
  difficulty: number;
  board: string;
  solution: string;
}
