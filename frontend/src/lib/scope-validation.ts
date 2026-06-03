import type { ScopedExtractionPlan, ScopedParameter } from "../types";

const SAFE_ID_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const INSTRUCTION_LIKE_RE = /\b(ignore|disregard|forget|override|previous instructions?|system prompt|developer message|api key|secret|hidden text|send the full document|extract all)\b/i;
const MAX_PARAMETERS = 50;
const VALUE_TYPES = new Set(["target_value", "actual_value", "comment", "performed_by_initials", "performed_date", "verified_by_initials", "verified_date"]);
const REQUIRED_EVIDENCE = new Set(["page_number", "source_label", "nearby_text"]);

export interface ScopeValidationResult { valid: boolean; errors: string[]; }

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

function validateStringArray(parameter: Record<string, unknown>, field: "expected_units" | "synonyms", index: number, maxItems: number, errors: string[]) {
  const raw = parameter[field];
  if (!Array.isArray(raw)) { errors.push(`Parameter ${index + 1} ${field} must be an array.`); return; }
  if (raw.length > maxItems) errors.push(`Parameter ${index + 1} ${field} must include at most ${maxItems} items.`);
  if (raw.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) errors.push(`Parameter ${index + 1} ${field} must contain non-empty strings.`);
  if (raw.some((entry) => typeof entry === "string" && INSTRUCTION_LIKE_RE.test(entry))) errors.push(`Parameter ${index + 1} ${field} contains instruction-like text.`);
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
      if (!parameter) { errors.push(`Parameter ${index + 1} must be an object.`); return; }
      const id = typeof parameter.parameter_id === "string" ? parameter.parameter_id.trim() : "";
      if (!SAFE_ID_RE.test(id)) errors.push(`Parameter ${index + 1} has an unsafe parameter_id.`);
      if (ids.has(id)) errors.push(`Duplicate parameter_id: ${id}.`);
      ids.add(id);
      const displayName = typeof parameter.display_name === "string" ? parameter.display_name.trim() : "";
      const description = typeof parameter.description === "string" ? parameter.description.trim() : "";
      if (!displayName) errors.push(`Parameter ${index + 1} needs a display name.`);
      if (displayName.length > 120) errors.push(`Parameter ${index + 1} display name is too long.`);
      if (description.length > 500) errors.push(`Parameter ${index + 1} description is too long.`);
      if (INSTRUCTION_LIKE_RE.test(displayName)) errors.push(`Parameter ${index + 1} display name contains instruction-like text.`);
      if (INSTRUCTION_LIKE_RE.test(description)) errors.push(`Parameter ${index + 1} description contains instruction-like text.`);
      validateStringArray(parameter, "expected_units", index, 20, errors);
      validateStringArray(parameter, "synonyms", index, 20, errors);
      const valueTypes = parameter.value_types;
      if (!Array.isArray(valueTypes) || valueTypes.length === 0) errors.push(`Parameter ${index + 1} value_types must include at least one value.`);
      else if (valueTypes.some((item) => typeof item !== "string" || !VALUE_TYPES.has(item))) errors.push(`Parameter ${index + 1} value_types contains an unknown value.`);
      const evidence = parameter.required_evidence;
      if (!Array.isArray(evidence) || evidence.length === 0) errors.push(`Parameter ${index + 1} required_evidence must include at least one value.`);
      else if (evidence.some((item) => typeof item !== "string" || !REQUIRED_EVIDENCE.has(item))) errors.push(`Parameter ${index + 1} required_evidence contains an unknown value.`);
      const rules = parameter.needs_review_rules;
      if (!Array.isArray(rules)) errors.push(`Parameter ${index + 1} needs_review_rules must be an array.`);
      else if (rules.length > 20 || rules.some((rule) => typeof rule !== "string" || rule.trim().length === 0 || rule.length > 80)) errors.push(`Parameter ${index + 1} needs_review_rules are invalid.`);
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
