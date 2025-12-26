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

// Solver types
export interface SolverBoard {
  original: string;
  user: string | null;
  solution: string | null;
  pencilmarks: {
    auto: boolean;
    pencilmarks: string;
  } | null;
}

export interface SolveData {
  board: SolverBoard;
  hints: Array<{
    title: string;
    text: string;
    areas: Array<{ type: string; color: string; index: number }>;
    cells: Array<{
      row: number;
      column: number;
      color: string;
      fill: boolean;
      actions: {
        select: string;
        unselect: string;
        add: string;
        remove: string;
        highlight: string;
      };
    }>;
  }>;
}

export interface ValidateData {
  board: SolverBoard;
  hints: null;
}

export interface GenerateData {
  board: SolverBoard;
  level: number;
  techniques: number;
  hints: null;
}
