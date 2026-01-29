// Type helpers for tests
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface LevelData {
  level: number;
  title: string;
  text: string | null;
  requires_subscription: boolean | null;
}

export interface TechniqueData {
  technique: number;
  level: number | null;
  title: string;
  text: string | null;
}

export interface LearningData {
  uuid: string;
  technique: number | null;
  index: number;
  language_code: string;
  text: string | null;
  image_url: string | null;
}

export interface BoardData {
  uuid: string;
  level: number | null;
  symmetrical: boolean | null;
  board: string;
  solution: string;
  techniques: number | null;
}

export interface DailyData {
  uuid: string;
  date: string;
  board_uuid: string | null;
  level: number | null;
  techniques: number | null;
  board: string;
  solution: string;
}

export interface ChallengeData {
  uuid: string;
  board_uuid: string | null;
  level: number | null;
  difficulty: number | null;
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
