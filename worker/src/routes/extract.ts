// ── Extract page route ─────────────────────────────────────────────

import { Hono } from "hono";
import { extractPage } from "../lib/gemini";
import { validatePageResponse } from "../lib/validator";
import type { Env, ExtractPageRequest, ExtractPageResponse } from "../types";

const extractRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/extract-page
 *
 * Accepts a single page image (base64) and page number.
 * Calls Gemini, validates the response, returns structured data.
 */
extractRouter.post("/extract-page", async (c) => {
  let body: ExtractPageRequest;

  try {
    body = await c.req.json<ExtractPageRequest>();
  } catch {
    return c.json(
      { success: false, errors: ["Invalid JSON body"], page_extraction: null },
      400
    );
  }

  const { image_base64, page_number, mime_type } = body;

  if (!image_base64 || typeof page_number !== "number") {
    return c.json(
      {
        success: false,
        errors: ["Missing required fields: image_base64, page_number"],
        page_extraction: null,
      },
      400
    );
  }

  const apiKey = c.env.GEMINI_API_KEY;
  const model = c.env.GEMINI_MODEL || "gemini-3-flash-preview";

  if (!apiKey) {
    return c.json(
      {
        success: false,
        errors: ["GEMINI_API_KEY not configured on server"],
        page_extraction: null,
      },
      500
    );
  }

  try {
    // Call Gemini
    const rawText = await extractPage(
      image_base64,
      page_number,
      apiKey,
      model,
      mime_type || "image/png"
    );

    // Validate
    const result = validatePageResponse(rawText, page_number);

    const response: ExtractPageResponse = {
      success: result.valid,
      page_extraction: result.page_extraction,
      errors: result.errors,
      raw_text: rawText,
    };

    return c.json(response, result.valid ? 200 : 422);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Extraction failed for page ${page_number}: ${message}`);

    return c.json(
      {
        success: false,
        errors: [message],
        page_extraction: null,
      } satisfies ExtractPageResponse,
      500
    );
  }
});

export default extractRouter;
