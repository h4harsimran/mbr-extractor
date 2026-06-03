import { z } from "zod";

export const MAX_SCOPE_INPUT_CHARS = 10_000;
export const MAX_SCOPED_PARAMETERS = 50;
export const MAX_SYNONYMS_PER_PARAMETER = 20;
export const MAX_EXPECTED_UNITS_PER_PARAMETER = 20;
export const MAX_SCOPE_JSON_CHARS = 60_000;

const SAFE_SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const INSTRUCTION_LIKE_RE = /\b(ignore|disregard|forget|override|previous instructions?|system prompt|developer message|api key|secret|hidden text|send the full document|extract all)\b/i;

export const ScopedValueTypeSchema = z.enum([
  "target_value",
  "actual_value",
  "comment",
  "performed_by_initials",
  "performed_date",
  "verified_by_initials",
  "verified_date",
]);

export const ScopedEvidenceSchema = z.enum(["page_number", "source_label", "nearby_text"]);

const noInstructionText = (max: number, min = 1) =>
  z.string().trim().min(min).max(max).refine((value) => !INSTRUCTION_LIKE_RE.test(value), {
    message: "instruction-like text is not allowed in scoped parameters",
  });

const dedupeStringArray = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export const ScopedParameterSchema = z
  .object({
    parameter_id: z.string().trim().regex(SAFE_SLUG_RE).max(80),
    display_name: noInstructionText(120),
    description: noInstructionText(500, 0).default(""),
    expected_units: z.array(noInstructionText(40)).max(MAX_EXPECTED_UNITS_PER_PARAMETER).default([]).transform(dedupeStringArray),
    synonyms: z.array(noInstructionText(120)).max(MAX_SYNONYMS_PER_PARAMETER).default([]).transform(dedupeStringArray),
    value_types: z.array(ScopedValueTypeSchema).min(1).default(["actual_value"]),
    required_evidence: z.array(ScopedEvidenceSchema).min(1).default(["page_number", "source_label", "nearby_text"]),
    needs_review_rules: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  })
  .strip();

export const ScopedExtractionPlanSchema = z
  .object({
    scope_version: z.literal(1),
    document_type: z.literal("master_batch_record"),
    extraction_mode: z.literal("scoped"),
    parameters: z.array(ScopedParameterSchema).min(1).max(MAX_SCOPED_PARAMETERS),
  })
  .strip()
  .refine((plan) => new Set(plan.parameters.map((parameter) => parameter.parameter_id)).size === plan.parameters.length, {
    message: "duplicate parameter_id values are not allowed",
    path: ["parameters"],
  });

export type ScopedValueType = z.infer<typeof ScopedValueTypeSchema>;
export type ScopedParameter = z.infer<typeof ScopedParameterSchema>;
export type ScopedExtractionPlan = z.infer<typeof ScopedExtractionPlanSchema>;

export function slugifyParameterName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 80)
    .replace(/_+$/g, "");
  return slug || "parameter";
}

export function parseRawParameterCandidates(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .flatMap((line) => line.split(/\t+/))
    .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

export function isInstructionLikeParameter(value: string): boolean {
  return INSTRUCTION_LIKE_RE.test(value) || value.length > 120;
}

export function validateScopedPlan(value: unknown) {
  return ScopedExtractionPlanSchema.safeParse(value);
}
