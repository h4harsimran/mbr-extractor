import type { ApiError, ApiErrorCode, ExtractPageResponse } from "../types";

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_REQUEST: "invalid request",
  PAYLOAD_TOO_LARGE: "payload too large",
  PROVIDER_FAILED: "provider failed",
  INVALID_MODEL_JSON: "invalid model JSON",
  SERVER_MISCONFIGURED: "server misconfigured",
  INVALID_SCOPE_INPUT: "invalid scope input",
};

export function apiError(code: ApiErrorCode, message = DEFAULT_MESSAGES[code]): ApiError {
  return { code, message };
}

export function errorResponse(code: ApiErrorCode, message?: string): ExtractPageResponse {
  return {
    success: false,
    page_extraction: null,
    errors: [apiError(code, message)],
  };
}
