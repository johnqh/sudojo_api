/**
 * Log lines for an OCR result: which digits were recognized, split into the
 * puzzle's givens and the digits a player had entered (drawn in another
 * color), so a bad scan can be diagnosed from the server log.
 *
 * Boards are logged as 9 rows separated by `/`, `.` for an empty cell. They
 * are puzzle digits only, nothing about the user or the image.
 */

import type { OCRExtractData } from "@sudobility/sudojo_types";

const BOARD = /^[0-9]{81}$/;

/** `530070000...` → `53..7..../...` (rows joined by `/`). */
export function formatBoardRows(board: string): string {
  const rows: string[] = [];
  for (let r = 0; r < 9; r++) {
    rows.push(board.slice(r * 9, r * 9 + 9).replace(/0/g, "."));
  }
  return rows.join("/");
}

export interface RecognizedDigits {
  /** Givens (`board.original`), 81 chars. */
  givens: string;
  /** Player-entered digits only (cells empty in `original`), 81 chars. */
  userDigits: string;
  givenCount: number;
  userDigitCount: number;
}

/**
 * Split an OCR board into givens and player digits. `board.user` may or may
 * not include the givens (the ML engine includes them); either way only cells
 * that are empty in `original` count as player digits.
 */
export function splitRecognizedDigits(
  data: OCRExtractData
): RecognizedDigits | null {
  const original = data.board?.original;
  if (!original || !BOARD.test(original)) return null;
  const user =
    data.board.user && BOARD.test(data.board.user) ? data.board.user : null;

  let userDigits = "";
  for (let i = 0; i < 81; i++) {
    userDigits += original[i] === "0" && user ? user[i] : "0";
  }
  const count = (s: string) => s.replace(/0/g, "").length;
  return {
    givens: original,
    userDigits,
    givenCount: count(original),
    userDigitCount: count(userDigits),
  };
}

/** The log lines for one OCR result (summary, givens, user digits). */
export function describeRecognizedDigits(
  engine: string,
  data: OCRExtractData
): string[] {
  const split = splitRecognizedDigits(data);
  if (!split) {
    return [`[OCR] ${engine} returned no 81-cell board`];
  }
  const pencilmarkCells = (data.board.pencilmark?.numbers ?? "")
    .split(",")
    .filter(Boolean).length;
  return [
    `[OCR] ${engine} recognized givens=${split.givenCount} ` +
      `user=${split.userDigitCount} ` +
      `total=${split.givenCount + split.userDigitCount} ` +
      `pencilmarkCells=${pencilmarkCells} conf=${Math.round(data.confidence)}`,
    `[OCR]   givens ${formatBoardRows(split.givens)}`,
    `[OCR]   user   ${formatBoardRows(split.userDigits)}`,
  ];
}
