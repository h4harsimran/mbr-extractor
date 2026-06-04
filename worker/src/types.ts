// ── Shared types for MBR extraction ────────────────────────────────

export type WarningCode =
  | "MISSING_ACTUAL_VALUE"
  | "MISSING_PERFORMED_BY"
  | "MISSING_VERIFIED_BY"
  | "LOW_CONFIDENCE"
  | "PAGE_NUMBER_MISMATCH"
  | "MODEL_SCHEMA_REPAIR"
  | "EXCESS_ROWS";

export type ScopedReviewReason =
  | "PARAMETER_NOT_FOUND_IN_DOCUMENT"
  | "MISSING_ACTUAL_VALUE"
  | "UNIT_MISMATCH"
  | "LOW_CONFIDENCE"
  | "AMBIGUOUS_VALUE"
  | "PAGE_NUMBER_MISMATCH";

export interface ExtractionWarning {
  code: WarningCode;
  message: string;
  row_id?: string | null;
  page_number?: number;
}

export interface ExtractedRow {
  page_number: number;
  row_id: string | null;
  parameter_label: string | null;
  target_value: string | null;
  actual_value: string | null;
  units: string | null;
  comments: string | null;
  performed_by_initials: string | null;
  performed_date: string | null;
  verified_by_initials: string | null;
  verified_date: string | null;
  extraction_confidence: number;
  needs_review: boolean;
  warnings?: ExtractionWarning[];
}

export interface PageExtraction {
  page_number: number;
  lot_number: string | null;
  rows: ExtractedRow[];
  warnings?: ExtractionWarning[];
}

export type ReviewStatus = "open" | "accepted" | "not_applicable";

export interface ScopedExtractionResult {
  parameter_id: string;
  display_name: string;
  matched?: boolean;
  target_value: string | null;
  actual_value: string | null;
  units: string | null;
  source_label: string | null;
  nearby_text: string | null;
  comments: string | null;
  performed_by_initials: string | null;
  performed_date: string | null;
  verified_by_initials: string | null;
  verified_date: string | null;
  extraction_confidence: number;
  needs_review: boolean;
  review_reasons: string[];
  review_status?: ReviewStatus;
  edited_by_user?: boolean;
}

export interface ScopedPageExtraction {
  page_number: number;
  lot_number: string | null;
  scoped_results: ScopedExtractionResult[];
  matches?: ScopedExtractionResult[];
  page_warnings?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  page_extraction: PageExtraction | null;
  raw_text: string | null;
}

export interface ExtractPageRequest {
  image_base64: string;
  page_number: number;
  mime_type?: string;
  extraction_mode?: "full" | "scoped";
  scope?: unknown;
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "PROVIDER_FAILED"
  | "INVALID_MODEL_JSON"
  | "SERVER_MISCONFIGURED"
  | "INVALID_SCOPE_INPUT";

export interface ApiError {
  code: ApiErrorCode;
  message: string;
}

export interface ExtractPageResponse {
  success: boolean;
  page_extraction: PageExtraction | null;
  scoped_page_extraction?: ScopedPageExtraction | null;
  errors: ApiError[];
  raw_text?: string;
}

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  MAX_REQUEST_BYTES?: string;
  MAX_IMAGE_BASE64_CHARS?: string;
  DEBUG_RAW_MODEL_OUTPUT?: string;
}
