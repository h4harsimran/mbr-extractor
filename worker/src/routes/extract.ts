// ── Extract page route ─────────────────────────────────────────────

import { Hono } from "hono";
import { getConfig } from "../config";
import { errorResponse } from "../lib/api-errors";
import { extractPage, extractScopedPage } from "../lib/gemini";
import { parseAndValidateExtractRequest } from "../lib/request-validation";
import { validateScopedPageResponse } from "../lib/scoped-extraction-validator";
import { validateScopedPlan } from "../lib/scope-schema";
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

  const { image_base64, page_number, mime_type, extraction_mode, scope } = requestResult.value;

  try {
    if (extraction_mode === "scoped") {
      const scopeResult = validateScopedPlan(scope);
      if (!scopeResult.success) {
        return c.json(
          { success: false, page_extraction: null, scoped_page_extraction: null, errors: [errorResponse("INVALID_SCOPE_INPUT").errors[0]] } satisfies ExtractPageResponse,
          400
        );
      }

      const rawText = await extractScopedPage(
        image_base64,
        page_number,
        scopeResult.data,
        config.geminiApiKey,
        config.geminiModel,
        mime_type
      );
      const result = validateScopedPageResponse(rawText, page_number, scopeResult.data);
      if (!result.valid || !result.scoped_page_extraction) return c.json(errorResponse("INVALID_MODEL_JSON"), 502);

      return c.json(
        {
          success: true,
          page_extraction: null,
          scoped_page_extraction: result.scoped_page_extraction,
          errors: [],
          ...(config.debugRawModelOutput ? { raw_text: rawText } : {}),
        } satisfies ExtractPageResponse,
        200
      );
    }

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
