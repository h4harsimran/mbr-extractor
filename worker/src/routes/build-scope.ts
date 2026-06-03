import { Hono } from "hono";
import { getConfig } from "../config";
import { apiError, errorResponse } from "../lib/api-errors";
import { buildScopeWithGemini } from "../lib/gemini";
import {
  MAX_SCOPE_INPUT_CHARS,
  MAX_SCOPED_PARAMETERS,
  MAX_SCOPE_JSON_CHARS,
  isInstructionLikeParameter,
  parseRawParameterCandidates,
  validateScopedPlan,
} from "../lib/scope-schema";
import type { Env } from "../types";

const router = new Hono<{ Bindings: Env }>();

type BuildScopeBody = {
  raw_parameters?: unknown;
  document_context?: unknown;
  mode?: unknown;
};

function invalid(message: string, status: 400 | 413 = 400) {
  return { status, body: { success: false, error: apiError("INVALID_SCOPE_INPUT", message) } };
}

router.post("/build-scope", async (c) => {
  const config = getConfig(c.env);
  const contentLength = c.req.header("content-length");
  if (contentLength && Number(contentLength) > Math.min(config.maxRequestBytes, MAX_SCOPE_INPUT_CHARS + 3000)) {
    const result = invalid("Scope builder request is too large.", 413);
    return c.json(result.body, result.status);
  }

  let body: BuildScopeBody;
  try {
    body = await c.req.json();
  } catch {
    const result = invalid("Request body must be valid JSON.");
    return c.json(result.body, result.status);
  }

  if (typeof body.raw_parameters !== "string" || body.raw_parameters.trim().length === 0) {
    const result = invalid("Provide at least one extraction parameter.");
    return c.json(result.body, result.status);
  }

  if (body.raw_parameters.length > MAX_SCOPE_INPUT_CHARS) {
    const result = invalid(`Scope input exceeds ${MAX_SCOPE_INPUT_CHARS} characters.`, 413);
    return c.json(result.body, result.status);
  }

  const rawCandidates = parseRawParameterCandidates(body.raw_parameters);
  const safeCandidates = rawCandidates.filter((candidate) => !isInstructionLikeParameter(candidate));
  const warnings = rawCandidates.length === safeCandidates.length ? [] : ["Some instruction-like entries were ignored."];

  if (safeCandidates.length === 0) {
    const result = invalid("Provide at least one legitimate extraction parameter.");
    return c.json(result.body, result.status);
  }
  if (safeCandidates.length > MAX_SCOPED_PARAMETERS) {
    const result = invalid(`Scoped extraction supports at most ${MAX_SCOPED_PARAMETERS} parameters.`, 413);
    return c.json(result.body, result.status);
  }

  if (!config.geminiApiKey) return c.json(errorResponse("SERVER_MISCONFIGURED"), 500);

  try {
    const rawScope = await buildScopeWithGemini(
      safeCandidates.join("\n"),
      typeof body.document_context === "string" ? body.document_context : "",
      config.geminiApiKey,
      config.geminiModel
    );
    if (rawScope.length > MAX_SCOPE_JSON_CHARS) return c.json(errorResponse("INVALID_MODEL_JSON"), 502);
    const parsedJson = JSON.parse(rawScope);
    const result = validateScopedPlan(parsedJson);
    if (!result.success) return c.json(errorResponse("INVALID_MODEL_JSON"), 502);
    return c.json({ success: true, scope: result.data, warnings }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Scope builder failed: ${message}`);
    return c.json(errorResponse("PROVIDER_FAILED"), 502);
  }
});

export default router;
