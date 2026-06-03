// ── Gemini REST API client for Cloudflare Workers ──────────────────

import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { SCOPE_BUILDER_SYSTEM_PROMPT, buildScopeBuilderPrompt } from "./prompts/scope-builder";
import { SCOPED_EXTRACTION_SYSTEM_PROMPT, buildScopedExtractionPrompt } from "./prompts/scoped-extraction";
import type { ScopedExtractionPlan } from "./scope-schema";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 2000;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; code?: number; status?: string };
}


function stripAndAssertJson(raw: string): string {
  let rawText = raw.trim();
  if (!rawText) throw new Error("Gemini returned empty response");
  if (rawText.startsWith("```")) {
    const lines = rawText.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim() === "```") lines.pop();
    rawText = lines.join("\n").trim();
  }
  JSON.parse(rawText);
  return rawText;
}

async function generateJson(
  systemPrompt: string,
  parts: Array<Record<string, unknown>>,
  apiKey: string,
  model: string,
  logContext: string,
  maxOutputTokens = 8192
): Promise<string> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  const requestBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens },
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(`Gemini API error ${response.status}`);
      const data = (await response.json()) as GeminiResponse;
      if (data.error) throw new Error(`Gemini error ${data.error.code ?? data.error.status ?? "unknown"}`);
      return stripAndAssertJson(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Gemini attempt ${attempt}/${MAX_RETRIES} failed`, { context: logContext, error_class: lastError.name, message: "Provider request failed" });
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`Gemini generation failed after ${MAX_RETRIES} attempts`);
}

/**
 * Extract structured data from a single MBR page image via Gemini.
 * Returns the raw JSON string from Gemini's response.
 */
export async function extractPage(
  imageBase64: string,
  pageNumber: number,
  apiKey: string,
  model: string = "gemini-3-flash-preview",
  mimeType: string = "image/png"
): Promise<string> {
  return generateJson(
    SYSTEM_PROMPT,
    [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
      { text: buildUserPrompt(pageNumber) },
    ],
    apiKey,
    model,
    `page ${pageNumber}`
  );
}

export async function buildScopeWithGemini(
  rawParameters: string,
  documentContext: string,
  apiKey: string,
  model: string = "gemini-3-flash-preview"
): Promise<string> {
  return generateJson(
    SCOPE_BUILDER_SYSTEM_PROMPT,
    [{ text: buildScopeBuilderPrompt(rawParameters, documentContext) }],
    apiKey,
    model,
    "scope builder",
    4096
  );
}

export async function extractScopedPage(
  imageBase64: string,
  pageNumber: number,
  scopedPlan: ScopedExtractionPlan,
  apiKey: string,
  model: string = "gemini-3-flash-preview",
  mimeType: string = "image/png"
): Promise<string> {
  return generateJson(
    SCOPED_EXTRACTION_SYSTEM_PROMPT,
    [
      { inline_data: { mime_type: mimeType, data: imageBase64 } },
      { text: buildScopedExtractionPrompt({ pageNumber, scopedPlan }) },
    ],
    apiKey,
    model,
    `scoped page ${pageNumber}`
  );
}
