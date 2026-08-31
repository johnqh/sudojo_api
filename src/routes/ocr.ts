/**
 * OCR Route - Extract Sudoku puzzles from images
 *
 * Uses @sudobility/sudojo_ocr for consistent OCR across all platforms.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import Tesseract from "tesseract.js";
import {
  extractSudokuFromImage,
  type TesseractModule,
  type CanvasAdapter,
} from "@sudobility/sudojo_ocr";
import { createNodeAdapter } from "@sudobility/sudojo_ocr/node";
import {
  successResponse,
  errorResponse,
  type OCRExtractData,
} from "@sudobility/sudojo_types";
import { extractViaML, isOCRMLEnabled } from "../services/ocr-ml-proxy";

const ocrRouter = new Hono();

// Singleton adapter for efficiency
let nodeAdapter: CanvasAdapter | null = null;

async function getAdapter(): Promise<CanvasAdapter> {
  if (!nodeAdapter) {
    nodeAdapter = await createNodeAdapter();
  }
  return nodeAdapter;
}

// Cast Tesseract to our minimal interface
const tesseractModule = Tesseract as unknown as TesseractModule;

// Request validation schema
const extractSchema = z.object({
  image: z.string().min(1, "Image data is required"),
});

// OCRExtractData type imported from @sudobility/sudojo_types

/**
 * POST /extract
 * Extract a Sudoku puzzle from an image
 *
 * Request body:
 * - image: Base64-encoded image data (without data URL prefix)
 *
 * Response:
 * - board: SolverBoard with original puzzle, user state, and pencilmark data
 * - confidence: OCR confidence score (0-100)
 * - digitCount: Number of digits recognized
 */
/** Minimum clues for a well-posed Sudoku. */
const MIN_CLUES = 17;

ocrRouter.post("/extract", zValidator("json", extractSchema), async c => {
  try {
    const { image } = c.req.valid("json");

    // Preferred path: the sudojo_ocr_ml whole-board model. Falls through to
    // Tesseract when the service is not configured or is unreachable.
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
        const data: OCRExtractData = {
          board: ml.board,
          confidence: ml.confidence,
          digitCount: ml.digitCount,
        };
        return c.json(successResponse(data));
      } catch (mlError) {
        const status = (mlError as Error & { status?: number }).status;
        if (status === 422) {
          // The model read the image and found too few clues. Tesseract will
          // not do better on the same pixels, so report it instead of retrying.
          return c.json(
            errorResponse(
              "Could not find enough digits in the image. Please retake the photo with the whole puzzle in frame."
            ),
            400
          );
        }
        console.warn("[OCR] ML service failed, falling back to Tesseract:", mlError);
      }
    }

    // Convert base64 to buffer
    // Handle both raw base64 and data URL format
    let base64Data = image;
    if (image.includes(",")) {
      base64Data = image.split(",")[1] || image;
    }

    const imageBuffer = Buffer.from(base64Data, "base64");

    // Get adapter
    const adapter = await getAdapter();

    // Run OCR
    const result = await extractSudokuFromImage(
      adapter,
      imageBuffer,
      tesseractModule,
      {
        skipBoardDetection: false,
        preprocess: true,
        minConfidence: 1,
        cellMargin: 0.03,
        recognizePencilmarks: true,
      }
    );

    // Validate result
    const puzzle = result.board.original;
    if (!puzzle || puzzle.length !== 81) {
      return c.json(
        errorResponse("Could not extract a valid puzzle from the image"),
        400
      );
    }

    // Check minimum clues
    if (result.digitCount < MIN_CLUES) {
      return c.json(
        errorResponse(
          `Only ${result.digitCount} clues detected, minimum ${MIN_CLUES} required for a valid puzzle`
        ),
        400
      );
    }

    const data: OCRExtractData = {
      board: result.board,
      confidence: result.confidence,
      digitCount: result.digitCount,
    };

    return c.json(successResponse(data));
  } catch (error) {
    console.error("[OCR] Extraction failed:", error);
    return c.json(
      errorResponse(
        "Failed to process image. Please try again with a clearer photo."
      ),
      500
    );
  }
});

export default ocrRouter;
