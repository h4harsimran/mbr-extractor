import type { AppConfig } from "../config";
import type { ExtractPageRequest } from "../types";
import { apiError } from "./api-errors";

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export type RequestValidationResult =
  | { ok: true; value: Required<Pick<ExtractPageRequest, "image_base64" | "page_number" | "mime_type">> & Pick<ExtractPageRequest, "extraction_mode" | "scope"> }
  | { ok: false; status: 400 | 413; error: ReturnType<typeof apiError> };

export async function parseAndValidateExtractRequest(
  request: Request,
  config: AppConfig
): Promise<RequestValidationResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > config.maxRequestBytes) {
    return { ok: false, status: 413, error: apiError("PAYLOAD_TOO_LARGE") };
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  if (bodyText.length > config.maxRequestBytes) {
    return { ok: false, status: 413, error: apiError("PAYLOAD_TOO_LARGE") };
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  const candidate = body as Partial<ExtractPageRequest>;
  const mimeType = candidate.mime_type ?? "image/jpeg";

  if (typeof candidate.image_base64 !== "string" || candidate.image_base64.length === 0) {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  if (candidate.image_base64.length > config.maxImageBase64Chars) {
    return { ok: false, status: 413, error: apiError("PAYLOAD_TOO_LARGE") };
  }

  if (!BASE64_RE.test(candidate.image_base64)) {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  if (!Number.isInteger(candidate.page_number) || Number(candidate.page_number) <= 0) {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  if (typeof mimeType !== "string" || !SUPPORTED_MIME_TYPES.has(mimeType)) {
    return { ok: false, status: 400, error: apiError("INVALID_REQUEST") };
  }

  return {
    ok: true,
    value: {
      image_base64: candidate.image_base64,
      page_number: candidate.page_number!,
      mime_type: mimeType,
      extraction_mode: candidate.extraction_mode === "scoped" ? "scoped" : "full",
      scope: candidate.scope,
    },
  };
}
