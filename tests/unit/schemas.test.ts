import { describe, it, expect } from "vitest";
import {
  levelCreateSchema,
  levelUpdateSchema,
  levelParamSchema,
  techniqueCreateSchema,
  techniqueUpdateSchema,
  techniqueParamSchema,
  techniquePathParamSchema,
  learningCreateSchema,
  learningUpdateSchema,
  boardCreateSchema,
  boardUpdateSchema,
  dailyCreateSchema,
  dailyUpdateSchema,
  challengeCreateSchema,
  challengeUpdateSchema,
  uuidParamSchema,
  dateParamSchema,
  userIdParamSchema,
  techniqueExampleCreateSchema,
  techniqueExampleUpdateSchema,
  techniquePracticeCreateSchema,
  gameStartSchema,
  gameFinishSchema,
  badgeDefinitionCreateSchema,
  badgeDefinitionUpdateSchema,
  badgeKeyParamSchema,
} from "../../src/schemas";

const validBoard = "0".repeat(81);
const validSolution = "1".repeat(81);
const validUuid = "123e4567-e89b-12d3-a456-426614174000";

describe("Schema Validation", () => {
  // =========================================================================
  // Level schemas
  // =========================================================================

  describe("levelCreateSchema", () => {
    it("should accept valid level data", () => {
      const result = levelCreateSchema.safeParse({
        level: 1,
        title: "Easy",
        text: "Easy puzzles",
        requires_subscription: false,
      });
      expect(result.success).toBe(true);
    });

    it("should accept minimal required fields", () => {
      const result = levelCreateSchema.safeParse({
        level: 1,
        title: "Easy",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe("");
        expect(result.data.requires_subscription).toBe(false);
      }
    });

    it("should accept max level (12)", () => {
      const result = levelCreateSchema.safeParse({
        level: 12,
        title: "Expert",
      });
      expect(result.success).toBe(true);
    });

    it("should reject level 0", () => {
      const result = levelCreateSchema.safeParse({
        level: 0,
        title: "Invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject level 13", () => {
      const result = levelCreateSchema.safeParse({
        level: 13,
        title: "Invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty title", () => {
      const result = levelCreateSchema.safeParse({
        level: 1,
        title: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer level", () => {
      const result = levelCreateSchema.safeParse({
        level: 1.5,
        title: "Easy",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing level", () => {
      const result = levelCreateSchema.safeParse({
        title: "Easy",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing title", () => {
      const result = levelCreateSchema.safeParse({
        level: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("levelUpdateSchema", () => {
    it("should accept partial updates", () => {
      const result = levelUpdateSchema.safeParse({
        title: "Medium",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = levelUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept requires_subscription update", () => {
      const result = levelUpdateSchema.safeParse({
        requires_subscription: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept null text", () => {
      const result = levelUpdateSchema.safeParse({
        text: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("levelParamSchema", () => {
    it("should coerce string to number", () => {
      const result = levelParamSchema.safeParse({ level: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.level).toBe(5);
      }
    });

    it("should reject level below 1", () => {
      const result = levelParamSchema.safeParse({ level: "0" });
      expect(result.success).toBe(false);
    });

    it("should reject level above 12", () => {
      const result = levelParamSchema.safeParse({ level: "13" });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Technique schemas
  // =========================================================================

  describe("techniqueCreateSchema", () => {
    it("should accept valid technique data", () => {
      const result = techniqueCreateSchema.safeParse({
        technique: 1,
        level: 1,
        title: "Naked Single",
        text: "Description",
      });
      expect(result.success).toBe(true);
    });

    it("should accept max technique (60)", () => {
      const result = techniqueCreateSchema.safeParse({
        technique: 60,
        level: 12,
        title: "Grouped X-Cycles",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid level", () => {
      const result = techniqueCreateSchema.safeParse({
        technique: 1,
        level: 0,
        title: "Naked Single",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid technique", () => {
      const result = techniqueCreateSchema.safeParse({
        technique: 61,
        level: 1,
        title: "Naked Single",
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative technique", () => {
      const result = techniqueCreateSchema.safeParse({
        technique: -1,
        level: 1,
        title: "Naked Single",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("techniqueUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = techniqueUpdateSchema.safeParse({ title: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = techniqueUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("techniqueParamSchema", () => {
    it("should coerce string to number", () => {
      const result = techniqueParamSchema.safeParse({ technique: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.technique).toBe(5);
      }
    });

    it("should reject technique above 60", () => {
      const result = techniqueParamSchema.safeParse({ technique: "61" });
      expect(result.success).toBe(false);
    });
  });

  describe("techniquePathParamSchema", () => {
    it("should accept valid path", () => {
      const result = techniquePathParamSchema.safeParse({ path: "naked-single" });
      expect(result.success).toBe(true);
    });

    it("should reject empty path", () => {
      const result = techniquePathParamSchema.safeParse({ path: "" });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Learning schemas
  // =========================================================================

  describe("learningCreateSchema", () => {
    it("should accept valid learning data", () => {
      const result = learningCreateSchema.safeParse({
        technique: 1,
        index: 0,
        language_code: "en",
        text: "Step 1",
      });
      expect(result.success).toBe(true);
    });

    it("should default language_code to 'en'", () => {
      const result = learningCreateSchema.safeParse({
        technique: 1,
        index: 0,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language_code).toBe("en");
      }
    });

    it("should accept image_url", () => {
      const result = learningCreateSchema.safeParse({
        technique: 1,
        index: 0,
        image_url: "https://example.com/image.png",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid image_url", () => {
      const result = learningCreateSchema.safeParse({
        technique: 1,
        index: 0,
        image_url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("learningUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = learningUpdateSchema.safeParse({ text: "Updated" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = learningUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Board schemas
  // =========================================================================

  describe("boardCreateSchema", () => {
    it("should accept valid board data", () => {
      const result = boardCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
    });

    it("should reject board with wrong length", () => {
      const result = boardCreateSchema.safeParse({
        board: "123",
        solution: validSolution,
      });
      expect(result.success).toBe(false);
    });

    it("should reject solution with wrong length", () => {
      const result = boardCreateSchema.safeParse({
        board: validBoard,
        solution: "123",
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional level", () => {
      const result = boardCreateSchema.safeParse({
        level: 1,
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
    });

    it("should default symmetrical to false", () => {
      const result = boardCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symmetrical).toBe(false);
      }
    });

    it("should default techniques to 0", () => {
      const result = boardCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.techniques).toBe(0);
      }
    });

    it("should coerce techniques from string", () => {
      const result = boardCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        techniques: "42",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.techniques).toBe(42);
      }
    });
  });

  describe("boardUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = boardUpdateSchema.safeParse({
        symmetrical: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept null level", () => {
      const result = boardUpdateSchema.safeParse({
        level: null,
      });
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Daily schemas
  // =========================================================================

  describe("dailyCreateSchema", () => {
    it("should accept valid daily data", () => {
      const result = dailyCreateSchema.safeParse({
        date: "2024-01-15",
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format", () => {
      const result = dailyCreateSchema.safeParse({
        date: "01-15-2024",
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(false);
    });

    it("should reject date with wrong separator", () => {
      const result = dailyCreateSchema.safeParse({
        date: "2024/01/15",
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(false);
    });

    it("should accept board_uuid", () => {
      const result = dailyCreateSchema.safeParse({
        date: "2024-01-15",
        board: validBoard,
        solution: validSolution,
        board_uuid: validUuid,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("dailyUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = dailyUpdateSchema.safeParse({
        date: "2024-02-15",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = dailyUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Challenge schemas
  // =========================================================================

  describe("challengeCreateSchema", () => {
    it("should accept valid challenge data", () => {
      const result = challengeCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        difficulty: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject difficulty below 1", () => {
      const result = challengeCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        difficulty: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject difficulty above 10", () => {
      const result = challengeCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        difficulty: 11,
      });
      expect(result.success).toBe(false);
    });

    it("should default difficulty to 1", () => {
      const result = challengeCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.difficulty).toBe(1);
      }
    });
  });

  describe("challengeUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = challengeUpdateSchema.safeParse({
        difficulty: 3,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = challengeUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject invalid difficulty", () => {
      const result = challengeUpdateSchema.safeParse({
        difficulty: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Param schemas
  // =========================================================================

  describe("uuidParamSchema", () => {
    it("should accept valid UUID", () => {
      const result = uuidParamSchema.safeParse({
        uuid: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = uuidParamSchema.safeParse({
        uuid: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty string", () => {
      const result = uuidParamSchema.safeParse({
        uuid: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("dateParamSchema", () => {
    it("should accept valid date", () => {
      const result = dateParamSchema.safeParse({
        date: "2024-01-15",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format", () => {
      const result = dateParamSchema.safeParse({
        date: "January 15, 2024",
      });
      expect(result.success).toBe(false);
    });

    it("should reject partial date", () => {
      const result = dateParamSchema.safeParse({
        date: "2024-01",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("userIdParamSchema", () => {
    it("should accept valid user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: "abc123def456",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty user ID", () => {
      const result = userIdParamSchema.safeParse({
        userId: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject user ID longer than 128 chars", () => {
      const result = userIdParamSchema.safeParse({
        userId: "a".repeat(129),
      });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Technique example schemas
  // =========================================================================

  describe("techniqueExampleCreateSchema", () => {
    it("should accept valid example data", () => {
      const result = techniqueExampleCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        techniques_bitfield: 1,
        primary_technique: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should accept with optional fields", () => {
      const result = techniqueExampleCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        techniques_bitfield: 3,
        primary_technique: 1,
        pencilmarks: "123,,456",
        hint_data: '{"areas":[],"cells":[]}',
        source_board_uuid: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("should reject zero techniques_bitfield", () => {
      const result = techniqueExampleCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        techniques_bitfield: 0,
        primary_technique: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject primary_technique above 60", () => {
      const result = techniqueExampleCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        techniques_bitfield: 1,
        primary_technique: 61,
      });
      expect(result.success).toBe(false);
    });

    it("should coerce techniques_bitfield from string", () => {
      const result = techniqueExampleCreateSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        techniques_bitfield: "42",
        primary_technique: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.techniques_bitfield).toBe(42);
      }
    });
  });

  describe("techniqueExampleUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = techniqueExampleUpdateSchema.safeParse({
        primary_technique: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = techniqueExampleUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Technique practice schemas
  // =========================================================================

  describe("techniquePracticeCreateSchema", () => {
    it("should accept valid practice data", () => {
      const result = techniquePracticeCreateSchema.safeParse({
        technique: 1,
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(true);
    });

    it("should accept with optional fields", () => {
      const result = techniquePracticeCreateSchema.safeParse({
        technique: 5,
        board: validBoard,
        solution: validSolution,
        pencilmarks: "123,,456",
        hint_data: '{"areas":[],"cells":[]}',
        source_example_uuid: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("should reject technique above 60", () => {
      const result = techniquePracticeCreateSchema.safeParse({
        technique: 61,
        board: validBoard,
        solution: validSolution,
      });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Gamification schemas
  // =========================================================================

  describe("gameStartSchema", () => {
    it("should accept valid game start data", () => {
      const result = gameStartSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        level: 1,
        puzzleType: "daily",
      });
      expect(result.success).toBe(true);
    });

    it("should accept level puzzleType", () => {
      const result = gameStartSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        level: 5,
        puzzleType: "level",
        puzzleId: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid puzzleType", () => {
      const result = gameStartSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        level: 1,
        puzzleType: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("should default techniques to 0", () => {
      const result = gameStartSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        level: 1,
        puzzleType: "daily",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.techniques).toBe(0);
      }
    });

    it("should reject level below 1", () => {
      const result = gameStartSchema.safeParse({
        board: validBoard,
        solution: validSolution,
        level: 0,
        puzzleType: "daily",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("gameFinishSchema", () => {
    it("should accept valid elapsed time", () => {
      const result = gameFinishSchema.safeParse({
        elapsedTime: 120,
      });
      expect(result.success).toBe(true);
    });

    it("should accept zero elapsed time", () => {
      const result = gameFinishSchema.safeParse({
        elapsedTime: 0,
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative elapsed time", () => {
      const result = gameFinishSchema.safeParse({
        elapsedTime: -1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer elapsed time", () => {
      const result = gameFinishSchema.safeParse({
        elapsedTime: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Badge schemas
  // =========================================================================

  describe("badgeDefinitionCreateSchema", () => {
    it("should accept valid badge data", () => {
      const result = badgeDefinitionCreateSchema.safeParse({
        badgeType: "level_mastery",
        badgeKey: "level_1",
        title: "White Belt",
      });
      expect(result.success).toBe(true);
    });

    it("should accept with optional fields", () => {
      const result = badgeDefinitionCreateSchema.safeParse({
        badgeType: "games_played",
        badgeKey: "games_100",
        title: "Centurion",
        description: "Complete 100 puzzles",
        iconUrl: "https://example.com/icon.png",
        requirementValue: 100,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty badgeKey", () => {
      const result = badgeDefinitionCreateSchema.safeParse({
        badgeType: "level_mastery",
        badgeKey: "",
        title: "White Belt",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("badgeDefinitionUpdateSchema", () => {
    it("should accept partial update", () => {
      const result = badgeDefinitionUpdateSchema.safeParse({
        title: "Updated Title",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = badgeDefinitionUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("badgeKeyParamSchema", () => {
    it("should accept valid badge key", () => {
      const result = badgeKeyParamSchema.safeParse({
        badgeKey: "level_1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty badge key", () => {
      const result = badgeKeyParamSchema.safeParse({
        badgeKey: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
