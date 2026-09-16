/**
 * OCR Route - Extract Sudoku puzzles from images
 *
 * Two interchangeable backends, chosen by where the image came from:
 * camera captures go straight to paddle_ocr, everything else prefers the
 * sudojo_ocr_ml whole-board model and falls back to paddle.
 */

import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  type OCRExtractData,
} from "@sudobility/sudojo_types";
import { extractViaML, isOCRMLEnabled } from "../services/ocr-ml-proxy";
import { extractViaPaddle, isPaddleEnabled } from "../services/ocr-paddle";

const ocrRouter = new Hono();

/** Minimum clues for a well-posed Sudoku. */
const MIN_CLUES = 17;

const extractSchema = z.object({
  image: z.string().min(1, "Image data is required"),
  source: z.enum(["camera", "library"]).default("library"),
});

const TOO_FEW_CLUES =
  "Could not find enough digits in the image. Please retake the photo with the whole puzzle in frame.";
const UNAVAILABLE = "Image recognition is unavailable";
const FAILED =
  "Failed to process image. Please try again with a clearer photo.";

/** Shared validation of a backend's board before it goes out. */
function validated(c: Context, data: OCRExtractData) {
  const puzzle = data.board.original;
  if (!puzzle || puzzle.length !== 81) {
    return c.json(
      errorResponse("Could not extract a valid puzzle from the image"),
      400
    );
  }
  if (data.digitCount < MIN_CLUES) {
    return c.json(errorResponse(TOO_FEW_CLUES), 400);
  }
  return c.json(successResponse(data));
}

/**
 * POST /extract
 * Extract a Sudoku puzzle from an image
 *
 * Request body:
 * - image: Base64-encoded image data (a data URL prefix is accepted)
 * - source: "camera" | "library" (default "library")
 *
 * Response:
 * - board: SolverBoard with original puzzle, user state, and pencilmark data
 * - confidence: OCR confidence score (0-100)
 * - digitCount: Number of digits recognized
 * - engine: which backend answered
 */
ocrRouter.post("/extract", zValidator("json", extractSchema), async c => {
  const { image, source } = c.req.valid("json");

  // Camera: paddle only. PP-OCRv6 reads real-world photographs better than the
  // whole-board model, which was trained on flat renders.
  if (source === "camera") {
    if (!isPaddleEnabled()) {
      return c.json(errorResponse(UNAVAILABLE), 503);
    }
    try {
      return validated(c, await extractViaPaddle(image));
    } catch (error) {
      console.error("[OCR] paddle failed:", error);
      return c.json(errorResponse(FAILED), 500);
    }
  }

  // Library: prefer the ML model, fall back to paddle.
  let mlError: unknown = null;
  if (isOCRMLEnabled()) {
    try {
      const ml = await extractViaML(image, MIN_CLUES);
      if (ml.debug) {
        console.log(
          `[OCR] ml detection=${ml.debug.detection} solvable=${ml.debug.solvable} ` +
            `repaired=${ml.debug.constraintRepaired} ${ml.debug.elapsedMs}ms ` +
            `digits=${ml.digitCount} conf=${ml.confidence}`
        );
      }
      return validated(c, {
        board: ml.board,
        confidence: ml.confidence,
        digitCount: ml.digitCount,
        engine: "ml",
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 422) {
        // The model read the image and found too few clues. Another engine will
        // not do better on the same pixels, so report it instead of retrying.
        return c.json(errorResponse(TOO_FEW_CLUES), 400);
      }
      mlError = err;
      console.warn("[OCR] ML service failed, falling back to paddle:", err);
    }
  }

  if (!isPaddleEnabled()) {
    if (mlError) {
      console.error("[OCR] ML failed and paddle is not configured:", mlError);
    }
    return c.json(errorResponse(UNAVAILABLE), 503);
  }

  try {
    return validated(c, await extractViaPaddle(image));
  } catch (error) {
    // Both backends failed. Report the ML error, the preferred engine's, since
    // its message is the more specific one.
    console.error("[OCR] paddle failed:", error);
    if (mlError) {
      console.error("[OCR] ML error was:", mlError);
    }
    return c.json(errorResponse(FAILED), 500);
  }
});

export default ocrRouter;
