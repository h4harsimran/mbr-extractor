export type WarningCode =
  | "MISSING_ACTUAL_VALUE"
  | "MISSING_PERFORMED_BY"
  | "MISSING_VERIFIED_BY"
  | "LOW_CONFIDENCE"
  | "PAGE_NUMBER_MISMATCH"
  | "MODEL_SCHEMA_REPAIR"
  | "EXCESS_ROWS";

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
  edited_by_user?: boolean;
  review_reason?: string | null;
}

export interface PageExtraction {
  page_number: number;
  lot_number: string | null;
  rows: ExtractedRow[];
  warnings?: ExtractionWarning[];
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ScopedParameter {
  parameter_id: string;
  display_name: string;
  description: string;
  expected_units: string[];
  synonyms: string[];
  value_types: Array<
    | "target_value"
    | "actual_value"
    | "comment"
    | "performed_by_initials"
    | "performed_date"
    | "verified_by_initials"
    | "verified_date"
  >;
  required_evidence: Array<"page_number" | "source_label" | "nearby_text">;
  needs_review_rules: string[];
}

export interface ScopedExtractionPlan {
  scope_version: 1;
  document_type: "master_batch_record";
  extraction_mode: "scoped";
  parameters: ScopedParameter[];
}

export interface ScopedExtractionResult {
  parameter_id: string;
  display_name: string;
  matched: boolean;
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
  edited_by_user?: boolean;
}

export interface ScopedPageExtraction {
  page_number: number;
  lot_number: string | null;
  scoped_results: ScopedExtractionResult[];
}

export type ExtractionMode = "full" | "scoped";

export interface BuildScopeResponse {
  success: boolean;
  scope?: ScopedExtractionPlan;
  warnings?: string[];
  error?: ApiError;
}

export interface ExtractPageResponse {
  success: boolean;
  page_extraction: PageExtraction | null;
  scoped_page_extraction?: ScopedPageExtraction | null;
  errors: ApiError[];
  raw_text?: string;
}

export type PageStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PageProgress {
  pageNumber: number;
  status: PageStatus;
  extraction: PageExtraction | null;
  scopedExtraction?: ScopedPageExtraction | null;
  error: string | null;
}

export type AppState = "upload" | "preflight" | "processing" | "results";

export interface UploadPreflight {
  file: File;
  filename: string;
  fileSizeBytes: number;
  pageCount: number;
}
