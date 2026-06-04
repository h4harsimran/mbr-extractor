import { z } from "zod";
import type { ScopedExtractionPlan } from "./scope-schema";
import type { ScopedPageExtraction, ScopedExtractionResult } from "../types";

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const MAX_SCOPED_RESULTS_PER_PAGE = 100;

const nullableString = z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, 1000);
});

const confidenceSchema = z.union([z.number(), z.string(), z.undefined()]).transform((value) => {
  if (value === undefined) return 0;
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numberValue)) return 0;
  if (numberValue > 1 && numberValue <= 100) return numberValue / 100;
  return Math.min(1, Math.max(0, numberValue));
});

const ScopedResultSchema = z
  .object({
    parameter_id: z.string().trim().min(1).max(80),
    display_name: z.string().trim().min(1).max(120).optional(),
    target_value: nullableString.default(null),
    actual_value: nullableString.default(null),
    units: nullableString.default(null),
    source_label: nullableString.default(null),
    nearby_text: nullableString.default(null),
    comments: nullableString.default(null),
    performed_by_initials: nullableString.default(null),
    performed_date: nullableString.default(null),
    verified_by_initials: nullableString.default(null),
    verified_date: nullableString.default(null),
    extraction_confidence: confidenceSchema.default(0),
    needs_review: z.boolean().default(false),
    review_reasons: z.array(z.string().trim().min(1).max(80)).default([]),
    review_status: z.enum(["open", "accepted", "not_applicable"]).optional(),
  })
  .strip();

const ScopedPageExtractionSchema = z
  .object({
    page_number: z.number().int().positive(),
    lot_number: nullableString.default(null),
    matches: z.array(z.unknown()).optional(),
    scoped_results: z.array(z.unknown()).optional(),
    page_warnings: z.array(z.string().trim().min(1).max(80)).default([]),
  })
  .strip();

export interface ScopedValidationResult {
  valid: boolean;
  errors: string[];
  scoped_page_extraction: ScopedPageExtraction | null;
  raw_text: string | null;
}

function addWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function normalizeReviewReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons.map((reason) => reason.trim()).filter(Boolean)));
}

export function validateScopedPageResponse(
  rawText: string,
  pageNumber: number,
  scopedPlan: ScopedExtractionPlan
): ScopedValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    return { valid: false, errors: ["invalid model JSON"], scoped_page_extraction: null, raw_text: rawText };
  }

  const parsed = ScopedPageExtractionSchema.safeParse(data);
  if (!parsed.success) {
    return { valid: false, errors: ["model schema mismatch"], scoped_page_extraction: null, raw_text: rawText };
  }

  const pageWarnings = [...parsed.data.page_warnings];
  const modelPageMismatch = parsed.data.page_number !== pageNumber;
  if (modelPageMismatch) addWarning(pageWarnings, "PAGE_NUMBER_MISMATCH");

  const scopedParameters = new Map(scopedPlan.parameters.map((parameter) => [parameter.parameter_id, parameter]));
  const rawMatches = (parsed.data.matches ?? parsed.data.scoped_results ?? []).slice(0, MAX_SCOPED_RESULTS_PER_PAGE);
  if ((parsed.data.matches ?? parsed.data.scoped_results ?? []).length > MAX_SCOPED_RESULTS_PER_PAGE) addWarning(pageWarnings, "EXCESS_SCOPED_MATCHES_TRUNCATED");

  const scoped_results: ScopedExtractionResult[] = [];
  for (const rawMatch of rawMatches) {
    const matchResult = ScopedResultSchema.safeParse(rawMatch);
    if (!matchResult.success) {
      addWarning(pageWarnings, "MALFORMED_MATCH_IGNORED");
      continue;
    }

    const scopeParameter = scopedParameters.get(matchResult.data.parameter_id);
    if (!scopeParameter) {
      addWarning(pageWarnings, "OUT_OF_SCOPE_PARAMETER_IGNORED");
      continue;
    }

    const review_reasons = normalizeReviewReasons(matchResult.data.review_reasons);
    if (matchResult.data.actual_value === null && !review_reasons.includes("MISSING_ACTUAL_VALUE")) {
      review_reasons.push("MISSING_ACTUAL_VALUE");
    }
    if (matchResult.data.extraction_confidence < LOW_CONFIDENCE_THRESHOLD && !review_reasons.includes("LOW_CONFIDENCE")) {
      review_reasons.push("LOW_CONFIDENCE");
    }
    if (modelPageMismatch && !review_reasons.includes("PAGE_NUMBER_MISMATCH")) {
      review_reasons.push("PAGE_NUMBER_MISMATCH");
    }

    const needs_review = matchResult.data.needs_review || review_reasons.length > 0;
    scoped_results.push({
      parameter_id: scopeParameter.parameter_id,
      display_name: scopeParameter.display_name,
      matched: true,
      target_value: matchResult.data.target_value,
      actual_value: matchResult.data.actual_value,
      units: matchResult.data.units,
      source_label: matchResult.data.source_label,
      nearby_text: matchResult.data.nearby_text,
      comments: matchResult.data.comments,
      performed_by_initials: matchResult.data.performed_by_initials,
      performed_date: matchResult.data.performed_date,
      verified_by_initials: matchResult.data.verified_by_initials,
      verified_date: matchResult.data.verified_date,
      extraction_confidence: matchResult.data.extraction_confidence,
      needs_review,
      review_reasons,
      review_status: matchResult.data.review_status ?? (needs_review ? "open" : "accepted"),
    });
  }

  return {
    valid: true,
    errors: [],
    scoped_page_extraction: {
      page_number: pageNumber,
      lot_number: parsed.data.lot_number,
      scoped_results,
      matches: scoped_results,
      page_warnings: pageWarnings,
    },
    raw_text: rawText,
  };
}
