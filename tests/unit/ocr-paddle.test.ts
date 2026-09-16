import { describe, it, expect } from "vitest";
import { isPaddleEnabled } from "../../src/services/ocr-paddle";

describe("isPaddleEnabled", () => {
  // The module reads PADDLE_OCR_URL at import time and .env.test sets no OCR
  // vars, so the paddle path is off under test. The route relies on this to
  // report 503 rather than degrading silently.
  it("is false when PADDLE_OCR_URL is unset", () => {
    expect(isPaddleEnabled()).toBe(false);
  });
});
