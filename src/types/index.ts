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
  level_uuid: string;
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
