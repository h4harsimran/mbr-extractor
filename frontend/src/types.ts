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

export interface ExtractPageResponse {
  success: boolean;
  page_extraction: PageExtraction | null;
  errors: ApiError[];
  raw_text?: string;
}

export type PageStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PageProgress {
  pageNumber: number;
  status: PageStatus;
  extraction: PageExtraction | null;
  error: string | null;
}

export type AppState = "upload" | "preflight" | "processing" | "results";

export interface UploadPreflight {
  file: File;
  filename: string;
  fileSizeBytes: number;
  pageCount: number;
}
