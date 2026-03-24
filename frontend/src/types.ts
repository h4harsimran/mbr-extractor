// ── Shared types for frontend ──────────────────────────────────────

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
}

export interface PageExtraction {
  page_number: number;
  lot_number: string | null;
  rows: ExtractedRow[];
}

export interface ExtractPageResponse {
  success: boolean;
  page_extraction: PageExtraction | null;
  errors: string[];
  raw_text?: string;
}

export type PageStatus = "pending" | "processing" | "completed" | "failed";

export interface PageProgress {
  pageNumber: number;
  status: PageStatus;
  extraction: PageExtraction | null;
  error: string | null;
}

export type AppState = "upload" | "processing" | "results";
