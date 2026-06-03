import type { ScopedExtractionPlan, ScopedParameter } from "../types";

const SAFE_ID_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const INSTRUCTION_LIKE_RE = /\b(ignore|disregard|forget|override|previous instructions?|system prompt|developer message|api key|secret|hidden text|send the full document|extract all)\b/i;
const MAX_PARAMETERS = 50;

export interface ScopeValidationResult {
  valid: boolean;
  errors: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function cleanStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, maxChars);
    if (!trimmed || INSTRUCTION_LIKE_RE.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
    if (cleaned.length >= maxItems) break;
  }
  return cleaned;
}

export function validateScopedExtractionPlan(value: unknown): ScopeValidationResult {
  const errors: string[] = [];
  const scope = asRecord(value);
  if (!scope) return { valid: false, errors: ["Scope must be an object."] };
  if (scope.scope_version !== 1) errors.push("Scope version must be 1.");
  if (scope.document_type !== "master_batch_record") errors.push("Document type must be master_batch_record.");
  if (scope.extraction_mode !== "scoped") errors.push("Extraction mode must be scoped.");
  if (!Array.isArray(scope.parameters)) errors.push("Scope must include parameters.");
  else {
    if (scope.parameters.length < 1) errors.push("Add at least one parameter.");
    if (scope.parameters.length > MAX_PARAMETERS) errors.push(`Use at most ${MAX_PARAMETERS} parameters.`);
    const ids = new Set<string>();
    scope.parameters.forEach((item, index) => {
      const parameter = asRecord(item);
      if (!parameter) {
        errors.push(`Parameter ${index + 1} must be an object.`);
        return;
      }
      const id = typeof parameter.parameter_id === "string" ? parameter.parameter_id.trim() : "";
      if (!SAFE_ID_RE.test(id)) errors.push(`Parameter ${index + 1} has an unsafe parameter_id.`);
      if (ids.has(id)) errors.push(`Duplicate parameter_id: ${id}.`);
      ids.add(id);
      const displayName = typeof parameter.display_name === "string" ? parameter.display_name.trim() : "";
      if (!displayName) errors.push(`Parameter ${index + 1} needs a display name.`);
      if (INSTRUCTION_LIKE_RE.test(displayName)) errors.push(`Parameter ${index + 1} display name contains instruction-like text.`);
      for (const field of ["description", "synonyms", "expected_units"] as const) {
        const raw = parameter[field];
        const values = Array.isArray(raw) ? raw : [raw];
        if (values.some((entry) => typeof entry === "string" && INSTRUCTION_LIKE_RE.test(entry))) {
          errors.push(`Parameter ${index + 1} ${field} contains instruction-like text.`);
        }
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

export function sanitizeScopedExtractionPlan(value: unknown): ScopedExtractionPlan | null {
  if (!validateScopedExtractionPlan(value).valid) return null;
  const scope = value as ScopedExtractionPlan;
  return {
    scope_version: 1,
    document_type: "master_batch_record",
    extraction_mode: "scoped",
    parameters: scope.parameters.map((parameter: ScopedParameter) => ({
      parameter_id: parameter.parameter_id.trim(),
      display_name: parameter.display_name.trim(),
      description: typeof parameter.description === "string" ? parameter.description.trim() : "",
      expected_units: cleanStringArray(parameter.expected_units, 20, 40),
      synonyms: cleanStringArray(parameter.synonyms, 20, 120),
      value_types: Array.isArray(parameter.value_types) && parameter.value_types.length > 0 ? parameter.value_types : ["actual_value"],
      required_evidence: Array.isArray(parameter.required_evidence) && parameter.required_evidence.length > 0 ? parameter.required_evidence : ["page_number", "source_label", "nearby_text"],
      needs_review_rules: cleanStringArray(parameter.needs_review_rules, 20, 80),
    })),
  };
}
