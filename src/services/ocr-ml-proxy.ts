/**
 * @fileoverview OCR ML proxy service
 *
 * Calls the sudojo_ocr_ml inference service (whole-board CNN) and normalises
 * its response into OCRExtractData.
 *
 * The service is optional: when OCR_ML_URL is unset, or the call fails, the
 * caller falls back to the Tesseract pipeline in @sudobility/sudojo_ocr. That
 * keeps image scanning working during a model rollout or an outage of the
 * inference box.
 */

import { getEnv } from "../lib/env-helper";
import type { OCRExtractData } from "@sudobility/sudojo_types";

const OCR_ML_URL = getEnv("OCR_ML_URL", "")!;
const OCR_ML_TIMEOUT_MS = parseInt(getEnv("OCR_ML_TIMEOUT_MS", "20000")!, 10);

/** Extra diagnostics the ML service returns alongside OCRExtractData. */
export interface OCRMLDebug {
  detection: "cornernet" | "classical" | "whole-image";
  solvable: "unique" | "multiple" | "unsolvable";
  constraintRepaired: boolean;
  /** Cells the model was unsure about — worth asking the user to confirm. */
  lowConfidenceCells: number[];
  /** "gpu" or "cpu"; useful for spotting a silent CPU fallback in production. */
  device: string;
  elapsedMs: number;
}

export interface OCRMLResult extends OCRExtractData {
  debug?: OCRMLDebug;
}

/** Whether the ML backend is configured for this deployment. */
export function isOCRMLEnabled(): boolean {
  return OCR_ML_URL.length > 0;
}

/**
 * Extract a puzzle via the ML service.
 *
 * @param image Base64 image data (with or without a data URL prefix)
 * @param minClues Minimum clue count the service should accept
 * @throws when the service is unreachable, times out, or rejects the image
 */
export async function extractViaML(
  image: string,
  minClues = 17
): Promise<OCRMLResult> {
  if (!isOCRMLEnabled()) {
    throw new Error("OCR_ML_URL is not configured");
  }

  const url = `${OCR_ML_URL}/v1/ocr`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OCR_ML_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, min_clues: minClues }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // 422 means the model read the image but found too few clues -- a real
      // answer about the image, not a service failure, so surface it as-is
      // rather than burning time on a Tesseract retry that will also fail.
      const detail = await response.text().catch(() => "");
      const err = new Error(
        `OCR ML service error ${response.status}: ${detail.slice(0, 200)}`
      );
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }

    return (await response.json()) as OCRMLResult;
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof Error && err.name === "AbortError") {
      console.error(
        `[extractViaML] Timed out after ${elapsedMs}ms (configured ${OCR_ML_TIMEOUT_MS}ms)`
      );
      throw new Error(
        `OCR ML service timeout after ${Math.round(elapsedMs / 1000)}s`
      );
    }
    console.error(`[extractViaML] Failed after ${elapsedMs}ms:`, err);
    throw err;
  }
}
