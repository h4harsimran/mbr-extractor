// ── Gemini REST API client for Cloudflare Workers ──────────────────

import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string; code: number };
}

/**
 * Extract structured data from a single MBR page image via Gemini.
 * Returns the raw JSON string from Gemini's response.
 */
export async function extractPage(
  imageBase64: string,
  pageNumber: number,
  apiKey: string,
  model: string = "gemini-2.0-flash",
  mimeType: string = "image/png"
): Promise<string> {
  const userPrompt = buildUserPrompt(pageNumber);
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Gemini API error ${response.status}: ${errorBody.slice(0, 500)}`
        );
      }

      const data = (await response.json()) as GeminiResponse;

      if (data.error) {
        throw new Error(
          `Gemini error ${data.error.code}: ${data.error.message}`
        );
      }

      let rawText =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

      if (!rawText) {
        throw new Error("Gemini returned empty response");
      }

      // Strip markdown fences if model wraps anyway
      if (rawText.startsWith("```")) {
        const lines = rawText.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines.length > 0 && lines[lines.length - 1].trim() === "```")
          lines.pop();
        rawText = lines.join("\n").trim();
      }

      // Sanity check — must be parseable JSON
      JSON.parse(rawText);
      return rawText;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `Gemini attempt ${attempt}/${MAX_RETRIES} failed for page ${pageNumber}: ${lastError.message}`
      );

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(
    `Gemini extraction failed after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}
