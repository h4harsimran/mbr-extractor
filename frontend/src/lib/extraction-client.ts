// ── API client for page extraction ─────────────────────────────────

import type { ExtractPageResponse } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

/**
 * Send a single page image to the worker for Gemini extraction.
 */
export async function extractPageFromApi(
  imageBase64: string,
  pageNumber: number
): Promise<ExtractPageResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/extract-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBase64,
          page_number: pageNumber,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
      }

      return (await response.json()) as ExtractPageResponse;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `API attempt ${attempt}/${MAX_RETRIES} for page ${pageNumber}: ${lastError.message}`
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  return {
    success: false,
    page_extraction: null,
    errors: [
      `Failed after ${MAX_RETRIES} attempts: ${lastError?.message ?? "Unknown error"}`,
    ],
  };
}
