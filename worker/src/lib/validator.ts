// ── Validation logic — ported from Python validator.py ─────────────

import { z } from "zod";
import type { PageExtraction, ValidationResult, ExtractedRow } from "../types";

// ── Zod schemas for runtime validation ─────────────────────────────

const ExtractedRowSchema = z.object({
  page_number: z.number(),
  row_id: z.string().nullable().default(null),
  parameter_label: z.string().nullable().default(null),
  target_value: z.string().nullable().default(null),
  actual_value: z.string().nullable().default(null),
  units: z.string().nullable().default(null),
  comments: z.string().nullable().default(null),
  performed_by_initials: z.string().nullable().default(null),
  performed_date: z.string().nullable().default(null),
  verified_by_initials: z.string().nullable().default(null),
  verified_date: z.string().nullable().default(null),
  extraction_confidence: z.number().min(0).max(1),
  needs_review: z.boolean().default(false),
});

const PageExtractionSchema = z.object({
  page_number: z.number(),
  lot_number: z.string().nullable().default(null),
  rows: z.array(ExtractedRowSchema).default([]),
});

/**
 * Validate raw Gemini JSON string against expected schema.
 * Port of Python validate_page_response().
 */
export function validatePageResponse(
  rawText: string,
  pageNumber: number
): ValidationResult {
  const errors: string[] = [];

  // Step 1 — JSON parse
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    return {
      valid: false,
      errors: [`JSON parse error: ${e instanceof Error ? e.message : String(e)}`],
      page_extraction: null,
      raw_text: rawText,
    };
  }

  // Step 2 — basic structure checks
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      valid: false,
      errors: ["Top-level JSON is not an object"],
      page_extraction: null,
      raw_text: rawText,
    };
  }

  const obj = data as Record<string, unknown>;

  // Default missing fields
  if (!("rows" in obj)) obj.rows = [];
  if (!("page_number" in obj)) obj.page_number = pageNumber;

  // Step 3 — Zod validation
  const parseResult = PageExtractionSchema.safeParse(obj);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      ),
      page_extraction: null,
      raw_text: rawText,
    };
  }

  const pageExtraction: PageExtraction = parseResult.data;

  // Step 4 — business-rule auto-flagging
  for (const row of pageExtraction.rows) {
    if (row.actual_value === null) {
      row.needs_review = true;
      errors.push(
        `Row ${row.row_id}: actual_value is null — auto-flagged for review`
      );
    }
    if (row.performed_by_initials === null) {
      row.needs_review = true;
      errors.push(`Row ${row.row_id}: performed_by_initials missing — flagged`);
    }
    if (row.verified_by_initials === null) {
      row.needs_review = true;
      errors.push(`Row ${row.row_id}: verified_by_initials missing — flagged`);
    }
  }

  return {
    valid: true,
    errors, // non-fatal warnings
    page_extraction: pageExtraction,
    raw_text: rawText,
  };
}
