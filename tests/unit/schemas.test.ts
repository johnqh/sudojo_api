import { describe, it, expect } from "vitest";
import {
  levelCreateSchema,
  levelUpdateSchema,
  techniqueCreateSchema,
  boardCreateSchema,
  dailyCreateSchema,
  challengeCreateSchema,
  uuidParamSchema,
  dateParamSchema,
} from "../../src/schemas";

describe("Schema Validation", () => {
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
  });

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
        technique: 38,
        level: 1,
        title: "Naked Single",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("boardCreateSchema", () => {
    const validBoard = "0".repeat(81);
    const validSolution = "1".repeat(81);

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
  });

  describe("dailyCreateSchema", () => {
    const validBoard = "0".repeat(81);
    const validSolution = "1".repeat(81);

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
  });

  describe("challengeCreateSchema", () => {
    const validBoard = "0".repeat(81);
    const validSolution = "1".repeat(81);

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

  describe("uuidParamSchema", () => {
    it("should accept valid UUID", () => {
      const result = uuidParamSchema.safeParse({
        uuid: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = uuidParamSchema.safeParse({
        uuid: "not-a-uuid",
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
  });
});
