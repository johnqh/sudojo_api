import { describe, expect, it } from "vitest";
import {
  describeRecognizedDigits,
  formatBoardRows,
  splitRecognizedDigits,
} from "../../src/lib/ocr-log";

// A Sudojo screenshot as the ML engine read it: 17 givens, and `user`
// holding the givens plus 11 digits the player had entered.
const ORIGINAL =
  "000010040530000000000000200200509000008000010000000030014000000000700600000200500";
const USER =
  "000015040530000100140000250201539000308000010400100030014050000000700600000200500";

const data = (user: string | undefined, numbers = "") => ({
  board: {
    original: ORIGINAL,
    user: user as string,
    pencilmark: { numbers, autopencil: false },
  },
  confidence: 98.4,
  digitCount: 17,
  engine: "ml" as const,
});

describe("ocr-log", () => {
  it("formats a board as 9 rows with dots for empty cells", () => {
    expect(formatBoardRows(ORIGINAL)).toBe(
      "....1..4./53......./......2../2..5.9.../..8....1./.......3./.14....../...7..6../...2..5.."
    );
  });

  it("splits givens from player digits whether or not user includes givens", () => {
    const split = splitRecognizedDigits(data(USER));
    expect(split?.givenCount).toBe(17);
    expect(split?.userDigitCount).toBe(11);
    expect(split?.userDigits[5]).toBe("5");
    expect(split?.userDigits[4]).toBe("0"); // a given cell
  });

  it("counts no player digits when user is missing or equals original", () => {
    expect(splitRecognizedDigits(data(undefined))?.userDigitCount).toBe(0);
    expect(splitRecognizedDigits(data(ORIGINAL))?.userDigitCount).toBe(0);
  });

  it("describes the result in three lines", () => {
    const lines = describeRecognizedDigits("ml", data(USER, "12,,3"));
    expect(lines[0]).toBe(
      "[OCR] ml recognized givens=17 user=11 total=28 pencilmarkCells=2 conf=98"
    );
    expect(lines[1]).toContain("givens ....1..4./");
    expect(lines[2]).toContain("user   .....5.../");
  });

  it("reports a missing board", () => {
    expect(
      describeRecognizedDigits("paddle", {
        ...data(USER),
        board: { ...data(USER).board, original: "123" },
      })
    ).toEqual(["[OCR] paddle returned no 81-cell board"]);
  });
});
