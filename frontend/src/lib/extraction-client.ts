import type { BuildScopeResponse, ExtractPageResponse, ScopedExtractionPlan } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

function normalizeErrorResponse(status: number, payload: unknown): ExtractPageResponse {
  if (payload && typeof payload === "object" && "errors" in payload) {
    const candidate = payload as ExtractPageResponse;
    return {
      success: false,
      page_extraction: null,
      scoped_page_extraction: null,
      errors: Array.isArray(candidate.errors) && candidate.errors.length > 0
        ? candidate.errors
        : [{ code: "REQUEST_FAILED", message: `Request failed (${status})` }],
    };
  }
  return {
    success: false,
    page_extraction: null,
    scoped_page_extraction: null,
    errors: [{ code: "REQUEST_FAILED", message: `Request failed (${status})` }],
  };
}

export async function buildScopeFromApi(
  rawParameters: string,
  documentContext: string,
  signal?: AbortSignal
): Promise<BuildScopeResponse> {
  const response = await fetch(`${API_BASE}/build-scope`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_parameters: rawParameters, document_context: documentContext, mode: "scoped_mbr" }),
    signal,
  });
  const payload = (await response.json().catch(() => null)) as BuildScopeResponse | null;
  if (!response.ok) {
    return payload ?? { success: false, error: { code: "REQUEST_FAILED", message: `Request failed (${response.status})` } };
  }
  return payload as BuildScopeResponse;
}

export async function extractPageFromApi(
  imageBase64: string,
  pageNumber: number,
  mimeType = "image/jpeg",
  signal?: AbortSignal,
  scopedPlan?: ScopedExtractionPlan
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
          mime_type: mimeType,
          extraction_mode: scopedPlan ? "scoped" : "full",
          ...(scopedPlan ? { scope: scopedPlan } : {}),
        }),
        signal,
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) return normalizeErrorResponse(response.status, payload);
      return payload as ExtractPageResponse;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { success: false, page_extraction: null, scoped_page_extraction: null, errors: [{ code: "CANCELLED", message: "Extraction cancelled" }] };
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  return {
    success: false,
    page_extraction: null,
    scoped_page_extraction: null,
    errors: [{ code: "NETWORK_ERROR", message: lastError?.message ?? "Network error" }],
  };
}
