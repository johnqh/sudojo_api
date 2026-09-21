import { describe, it, expect } from "vitest";
import { toValidateResponseData } from "./bitmask";

/**
 * A solver /validate or /generate `data`, with whatever `level` and bitmask
 * fields the caller wants to simulate.
 */
const solverData = (board: {
  level: number;
  techniques: number;
  techniques_bitmask?: string;
}) => ({
  board: {
    ...board,
    difficulty_score: 123,
    original: "0".repeat(81),
    solution: "1".repeat(81),
  },
});

describe("toValidateResponseData level override", () => {
  it("replaces the solver's level with the one derived from the bitmask", () => {
    // Bit 6 = Locked Candidates = level 3. The solver claims level 9; the API
    // owns the scale, so the response must say 3.
    const mask = (1n << 1n) | (1n << 3n) | (1n << 6n);
    const out = toValidateResponseData(
      solverData({
        level: 9,
        techniques: Number(mask),
        techniques_bitmask: mask.toString(),
      })
    );
    expect(out.board.level).toBe(3);
  });

  it("derives level 12 even when the solver under-reports it", () => {
    // This is the exact shape of the solver's old level-12 bug: a board needing
    // Forcing Chains (bit 36, L12) reported as level 11. The API must not care.
    const mask = (1n << 1n) | (1n << 3n) | (1n << 23n) | (1n << 36n);
    const out = toValidateResponseData(
      solverData({
        level: 11,
        techniques: Number(mask),
        techniques_bitmask: mask.toString(),
      })
    );
    expect(out.board.level).toBe(12);
  });

  it("uses the exact bitmask string, not the lossy number, to pick the level", () => {
    // Bit 60 (Grouped X-Cycles, L10) + bit 1 (Full House, L1). As a JS number
    // the low bit is lost, but the level must still come out as 10 and the
    // companion string must stay exact.
    const mask = (1n << 1n) | (1n << 60n);
    expect(mask).toBe(1152921504606846978n);
    const out = toValidateResponseData(
      solverData({
        level: 1,
        techniques: Number(mask), // 1152921504606846976 - low bit gone
        techniques_bitmask: mask.toString(),
      })
    );
    expect(out.board.level).toBe(10);
    expect(out.board.techniques_bitmask).toBe("1152921504606846978");
  });

  it("falls back to the numeric bitmask when the solver sends no string", () => {
    // An older solver deployment: no techniques_bitmask. Bit 24 = Skyscraper = L4.
    const mask = (1n << 3n) | (1n << 24n);
    const out = toValidateResponseData(
      solverData({ level: 1, techniques: Number(mask) })
    );
    expect(out.board.level).toBe(4);
  });

  it("derives a level even when the solver sends no level at all", () => {
    // sudojo_solver no longer returns `level` on /validate or /generate: the
    // 1-12 scale is owned here. The field must still appear in the response,
    // derived from the bitmask, so consumers are unaffected.
    const mask = (1n << 3n) | (1n << 6n); // Naked Single + Locked Candidates
    const boardWithoutLevel: Record<string, unknown> = {
      ...solverData({
        level: 0,
        techniques: Number(mask),
        techniques_bitmask: mask.toString(),
      }).board,
    };
    delete boardWithoutLevel.level;
    const out = toValidateResponseData({
      board: boardWithoutLevel as unknown as Parameters<
        typeof toValidateResponseData
      >[0]["board"],
    });
    expect(out.board.level).toBe(3);
  });

  it("reports level 1 for a board that needed no technique", () => {
    const out = toValidateResponseData(
      solverData({ level: 7, techniques: 0, techniques_bitmask: "0" })
    );
    expect(out.board.level).toBe(1);
  });

  it("leaves the rest of the board untouched", () => {
    const out = toValidateResponseData(
      solverData({ level: 2, techniques: 8, techniques_bitmask: "8" })
    );
    expect(out.board.difficulty_score).toBe(123);
    expect(out.board.original).toBe("0".repeat(81));
    expect(out.board.solution).toBe("1".repeat(81));
  });
});
