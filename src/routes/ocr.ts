/**
 * OCR Route - Extract Sudoku puzzles from images
 *
 * Uses @sudobility/sudojo_ocr for consistent OCR across all platforms.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Tesseract from 'tesseract.js';
import {
  extractSudokuFromImage,
  type TesseractModule,
  type CanvasAdapter,
} from '@sudobility/sudojo_ocr';
import { createNodeAdapter } from '@sudobility/sudojo_ocr/node';
import { successResponse, errorResponse } from '@sudobility/sudojo_types';

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
  image: z.string().min(1, 'Image data is required'),
});

// Response type
interface OCRExtractData {
  puzzle: string;
  confidence: number;
  digitCount: number;
}

/**
 * POST /extract
 * Extract a Sudoku puzzle from an image
 *
 * Request body:
 * - image: Base64-encoded image data (without data URL prefix)
 *
 * Response:
 * - puzzle: 81-character puzzle string
 * - confidence: OCR confidence score (0-100)
 * - digitCount: Number of digits recognized
 */
ocrRouter.post('/extract', zValidator('json', extractSchema), async (c) => {
  try {
    const { image } = c.req.valid('json');

    // Convert base64 to buffer
    // Handle both raw base64 and data URL format
    let base64Data = image;
    if (image.includes(',')) {
      base64Data = image.split(',')[1] || image;
    }

    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Get adapter
    const adapter = await getAdapter();

    // Run OCR
    const result = await extractSudokuFromImage(adapter, imageBuffer, tesseractModule, {
      skipBoardDetection: false,
      preprocess: true,
      minConfidence: 1,
      cellMargin: 0.154,
    });

    // Validate result
    if (!result.puzzle || result.puzzle.length !== 81) {
      return c.json(
        errorResponse('Could not extract a valid puzzle from the image'),
        400
      );
    }

    // Check minimum clues
    const digitCount = result.puzzle.replace(/0/g, '').length;
    if (digitCount < 17) {
      return c.json(
        errorResponse(`Only ${digitCount} clues detected, minimum 17 required for a valid puzzle`),
        400
      );
    }

    const data: OCRExtractData = {
      puzzle: result.puzzle,
      confidence: result.confidence,
      digitCount,
    };

    return c.json(successResponse(data));
  } catch (error) {
    console.error('[OCR] Extraction failed:', error);
    return c.json(
      errorResponse('Failed to process image. Please try again with a clearer photo.'),
      500
    );
  }
});

export default ocrRouter;
