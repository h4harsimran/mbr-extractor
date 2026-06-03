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

const confidenceSchema = z.union([z.number(), z.string()]).transform((value) => {
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numberValue)) return 0;
  if (numberValue > 1 && numberValue <= 100) return numberValue / 100;
  return Math.min(1, Math.max(0, numberValue));
});

const ScopedResultSchema = z
  .object({
    parameter_id: z.string().trim().min(1).max(80),
    display_name: z.string().trim().min(1).max(120),
    matched: z.boolean().default(false),
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
    scoped_results: z.array(ScopedResultSchema).default([]),
  })
  .strip();

export interface ScopedValidationResult {
  valid: boolean;
  errors: string[];
  scoped_page_extraction: ScopedPageExtraction | null;
  raw_text: string | null;
}

function missingResult(parameter: ScopedExtractionPlan["parameters"][number]): ScopedExtractionResult {
  return {
    parameter_id: parameter.parameter_id,
    display_name: parameter.display_name,
    matched: false,
    target_value: null,
    actual_value: null,
    units: null,
    source_label: null,
    nearby_text: null,
    comments: null,
    performed_by_initials: null,
    performed_date: null,
    verified_by_initials: null,
    verified_date: null,
    extraction_confidence: 0,
    needs_review: true,
    review_reasons: ["PARAMETER_NOT_FOUND_ON_PAGE"],
    review_status: "open",
  };
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

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as { scoped_results?: unknown };
    if (Array.isArray(obj.scoped_results) && obj.scoped_results.length > MAX_SCOPED_RESULTS_PER_PAGE) {
      obj.scoped_results = obj.scoped_results.slice(0, MAX_SCOPED_RESULTS_PER_PAGE);
    }
  }

  const parsed = ScopedPageExtractionSchema.safeParse(data);
  if (!parsed.success) {
    return { valid: false, errors: ["model schema mismatch"], scoped_page_extraction: null, raw_text: rawText };
  }

  const modelPageMismatch = parsed.data.page_number !== pageNumber;
  const scopedParameterIds = new Set(scopedPlan.parameters.map((parameter) => parameter.parameter_id));
  const byId = new Map(
    parsed.data.scoped_results
      .filter((result) => scopedParameterIds.has(result.parameter_id))
      .map((result) => [result.parameter_id, result])
  );
  const scoped_results = scopedPlan.parameters.map((parameter) => {
    const found = byId.get(parameter.parameter_id);
    if (!found) {
      const missing = missingResult(parameter);
      if (modelPageMismatch) missing.review_reasons.push("PAGE_NUMBER_MISMATCH");
      return missing;
    }

    const normalized: ScopedExtractionResult = {
      ...found,
      parameter_id: parameter.parameter_id,
      display_name: parameter.display_name,
      review_reasons: [...found.review_reasons],
      review_status: found.review_status,
    };

    if (!normalized.matched) {
      normalized.target_value = null;
      normalized.actual_value = null;
      normalized.units = null;
      normalized.source_label = null;
      normalized.nearby_text = null;
      normalized.extraction_confidence = 0;
      if (!normalized.review_reasons.includes("PARAMETER_NOT_FOUND_ON_PAGE")) {
        normalized.review_reasons.push("PARAMETER_NOT_FOUND_ON_PAGE");
      }
    }

    if (normalized.matched && normalized.actual_value === null && !normalized.review_reasons.includes("MISSING_ACTUAL_VALUE")) {
      normalized.review_reasons.push("MISSING_ACTUAL_VALUE");
    }
    if (normalized.extraction_confidence < LOW_CONFIDENCE_THRESHOLD && !normalized.review_reasons.includes("LOW_CONFIDENCE")) {
      normalized.review_reasons.push("LOW_CONFIDENCE");
    }
    if (modelPageMismatch && !normalized.review_reasons.includes("PAGE_NUMBER_MISMATCH")) {
      normalized.review_reasons.push("PAGE_NUMBER_MISMATCH");
    }
    normalized.needs_review = normalized.needs_review || normalized.review_reasons.length > 0;
    if (normalized.needs_review && !normalized.review_status) normalized.review_status = "open";
    return normalized;
  });

  return {
    valid: true,
    errors: [],
    scoped_page_extraction: {
      page_number: pageNumber,
      lot_number: parsed.data.lot_number,
      scoped_results,
    },
    raw_text: rawText,
  };
}
