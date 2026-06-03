// ── Validation and normalization for Gemini output ────────────────

import { z } from "zod";
import type { ExtractionWarning, PageExtraction, ValidationResult } from "../types";

const MAX_ROWS_PER_PAGE = 120;
const LOW_CONFIDENCE_THRESHOLD = 0.7;

const cleanString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

const limitedString = (max: number) =>
  cleanString.transform((value) => (value && value.length > max ? value.slice(0, max) : value));

const confidenceSchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const numberValue = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numberValue)) return 0;
    if (numberValue > 1 && numberValue <= 100) return numberValue / 100;
    return Math.min(1, Math.max(0, numberValue));
  });

const ExtractedRowSchema = z
  .object({
    page_number: z.number().int().positive(),
    row_id: limitedString(80).default(null),
    parameter_label: limitedString(240).default(null),
    target_value: limitedString(160).default(null),
    actual_value: limitedString(160).default(null),
    units: limitedString(80).default(null),
    comments: limitedString(500).default(null),
    performed_by_initials: limitedString(40).default(null),
    performed_date: limitedString(80).default(null),
    verified_by_initials: limitedString(40).default(null),
    verified_date: limitedString(80).default(null),
    extraction_confidence: confidenceSchema.default(0),
    needs_review: z.boolean().default(false),
  })
  .strip();

const PageExtractionSchema = z
  .object({
    page_number: z.number().int().positive(),
    lot_number: limitedString(120).default(null),
    rows: z.array(ExtractedRowSchema).default([]),
  })
  .strip();

function warning(
  code: ExtractionWarning["code"],
  message: string,
  row_id?: string | null,
  page_number?: number
): ExtractionWarning {
  return { code, message, row_id, page_number };
}

export function validatePageResponse(rawText: string, pageNumber: number): ValidationResult {
  const errors: string[] = [];
  const pageWarnings: ExtractionWarning[] = [];

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      errors: ["invalid model JSON"],
      page_extraction: null,
      raw_text: rawText,
    };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      valid: false,
      errors: ["model schema mismatch"],
      page_extraction: null,
      raw_text: rawText,
    };
  }

  const obj = { ...(data as Record<string, unknown>) };
  if (!("rows" in obj)) {
    obj.rows = [];
    pageWarnings.push(warning("MODEL_SCHEMA_REPAIR", "Missing rows array repaired", null, pageNumber));
  }
  if (!("page_number" in obj)) {
    obj.page_number = pageNumber;
    pageWarnings.push(warning("MODEL_SCHEMA_REPAIR", "Missing page_number repaired", null, pageNumber));
  }
  if (Array.isArray(obj.rows) && obj.rows.length > MAX_ROWS_PER_PAGE) {
    obj.rows = obj.rows.slice(0, MAX_ROWS_PER_PAGE);
    pageWarnings.push(warning("EXCESS_ROWS", "Rows truncated to configured per-page maximum", null, pageNumber));
  }

  const parseResult = PageExtractionSchema.safeParse(obj);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: ["model schema mismatch"],
      page_extraction: null,
      raw_text: rawText,
    };
  }

  const pageExtraction: PageExtraction = parseResult.data;

  if (pageExtraction.page_number !== pageNumber) {
    const item = warning(
      "PAGE_NUMBER_MISMATCH",
      `Model page_number ${pageExtraction.page_number} did not match requested page ${pageNumber}`,
      null,
      pageNumber
    );
    pageWarnings.push(item);
    pageExtraction.page_number = pageNumber;
  }

  pageExtraction.rows = pageExtraction.rows.map((row, index) => {
    const rowWarnings: ExtractionWarning[] = [];
    const normalized = { ...row, page_number: pageNumber };

    if (row.page_number !== pageNumber) {
      rowWarnings.push(
        warning("PAGE_NUMBER_MISMATCH", "Row page_number repaired to requested page", row.row_id, pageNumber)
      );
    }
    if (normalized.actual_value === null) {
      rowWarnings.push(warning("MISSING_ACTUAL_VALUE", "Actual value is missing", row.row_id, pageNumber));
    }
    if (normalized.performed_by_initials === null) {
      rowWarnings.push(warning("MISSING_PERFORMED_BY", "Performed-by initials are missing", row.row_id, pageNumber));
    }
    if (normalized.verified_by_initials === null) {
      rowWarnings.push(warning("MISSING_VERIFIED_BY", "Verified-by initials are missing", row.row_id, pageNumber));
    }
    if (normalized.extraction_confidence < LOW_CONFIDENCE_THRESHOLD) {
      rowWarnings.push(warning("LOW_CONFIDENCE", "Extraction confidence is below review threshold", row.row_id, pageNumber));
    }

    if (!normalized.row_id) normalized.row_id = `${pageNumber}.${index + 1}`;
    normalized.needs_review = normalized.needs_review || rowWarnings.length > 0;
    return { ...normalized, warnings: rowWarnings };
  });

  pageExtraction.warnings = pageWarnings;
  errors.push(...pageWarnings.map((item) => item.message));

  return {
    valid: true,
    errors,
    page_extraction: pageExtraction,
    raw_text: rawText,
  };
}
