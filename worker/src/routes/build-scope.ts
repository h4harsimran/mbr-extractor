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

async function readBoundedJson(request: Request, maxBytes: number): Promise<{ ok: true; body: BuildScopeBody } | { ok: false; status: 400 | 413; message: string }> {
  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return { ok: false, status: 400, message: "Request body must be valid JSON." };
  }
  if (bodyText.length > maxBytes) return { ok: false, status: 413, message: "Scope builder request is too large." };
  try {
    return { ok: true, body: JSON.parse(bodyText) as BuildScopeBody };
  } catch {
    return { ok: false, status: 400, message: "Request body must be valid JSON." };
  }
}

router.post("/build-scope", async (c) => {
  const config = getConfig(c.env);
  const contentLength = c.req.header("content-length");
  if (contentLength && Number(contentLength) > Math.min(config.maxRequestBytes, MAX_SCOPE_INPUT_CHARS + 3000)) {
    const result = invalid("Scope builder request is too large.", 413);
    return c.json(result.body, result.status);
  }

  const parsedBody = await readBoundedJson(c.req.raw, Math.min(config.maxRequestBytes, MAX_SCOPE_INPUT_CHARS + 3000));
  if (!parsedBody.ok) {
    const result = invalid(parsedBody.message, parsedBody.status);
    return c.json(result.body, result.status);
  }
  const body = parsedBody.body;

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
    console.error("Scope builder failed", { route: "build-scope", error_class: err instanceof Error ? err.name : typeof err, message: "Provider request failed" });
    return c.json(errorResponse("PROVIDER_FAILED"), 502);
  }
});

export default router;
