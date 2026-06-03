// ── Extract page route ─────────────────────────────────────────────

import { Hono } from "hono";
import { getConfig } from "../config";
import { errorResponse } from "../lib/api-errors";
import { extractPage } from "../lib/gemini";
import { parseAndValidateExtractRequest } from "../lib/request-validation";
import { validatePageResponse } from "../lib/validator";
import type { Env, ExtractPageResponse } from "../types";

const extractRouter = new Hono<{ Bindings: Env }>();

extractRouter.post("/extract-page", async (c) => {
  const config = getConfig(c.env);
  const requestResult = await parseAndValidateExtractRequest(c.req.raw, config);

  if (!requestResult.ok) {
    return c.json(
      {
        success: false,
        page_extraction: null,
        errors: [requestResult.error],
      } satisfies ExtractPageResponse,
      requestResult.status
    );
  }

  if (!config.geminiApiKey) {
    return c.json(errorResponse("SERVER_MISCONFIGURED"), 500);
  }

  const { image_base64, page_number, mime_type } = requestResult.value;

  try {
    const rawText = await extractPage(
      image_base64,
      page_number,
      config.geminiApiKey,
      config.geminiModel,
      mime_type
    );

    const result = validatePageResponse(rawText, page_number);
    if (!result.valid || !result.page_extraction) {
      return c.json(errorResponse("INVALID_MODEL_JSON"), 502);
    }

    const response: ExtractPageResponse = {
      success: true,
      page_extraction: result.page_extraction,
      errors: [],
      ...(config.debugRawModelOutput ? { raw_text: rawText } : {}),
    };

    return c.json(response, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Extraction provider failed for page ${page_number}: ${message}`);
    return c.json(errorResponse("PROVIDER_FAILED"), 502);
  }
});

export default extractRouter;
