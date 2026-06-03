import type { ScopedExtractionPlan, ScopedParameter } from "../../types";

interface ScopeReviewProps {
  scope: ScopedExtractionPlan;
  approved: boolean;
  onChange: (scope: ScopedExtractionPlan) => void;
  onApprove: () => void;
  validationErrors?: string[];
}

const VALUE_TYPES: ScopedParameter["value_types"] = ["target_value", "actual_value", "comment", "performed_by_initials", "performed_date", "verified_by_initials", "verified_date"];
const INSTRUCTION_LIKE_RE = /\b(ignore|disregard|forget|override|previous instructions?|system prompt|developer message|api key|secret|hidden text|send the full document|extract all)\b/i;

const blankParameter = (): ScopedParameter => ({
  parameter_id: `parameter_${Date.now()}`,
  display_name: "New parameter",
  description: "Extract this requested MBR field.",
  expected_units: [],
  synonyms: [],
  value_types: ["actual_value"],
  required_evidence: ["page_number", "source_label", "nearby_text"],
  needs_review_rules: ["missing_actual_value", "unit_mismatch", "low_confidence"],
});

function parseList(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/[\n,]+/).map((item) => item.trim()).filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parameterErrors(parameter: ScopedParameter, all: ScopedParameter[]): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(parameter.parameter_id)) errors.push("Use a lowercase snake_case parameter ID.");
  if (all.filter((item) => item.parameter_id === parameter.parameter_id).length > 1) errors.push("Duplicate parameter_id values are not allowed.");
  for (const [label, values] of [["display name", [parameter.display_name]], ["description", [parameter.description]], ["units", parameter.expected_units], ["synonyms", parameter.synonyms]] as const) {
    if (values.some((value) => INSTRUCTION_LIKE_RE.test(value))) errors.push(`${label} contains instruction-like text.`);
  }
  if (parameter.expected_units.length > 20) errors.push("Use at most 20 expected units.");
  if (parameter.synonyms.length > 20) errors.push("Use at most 20 synonyms.");
  if (parameter.value_types.length === 0) errors.push("Select at least one value type.");
  return errors;
}

export default function ScopeReview({ scope, approved, onChange, onApprove, validationErrors = [] }: ScopeReviewProps) {
  const allParameterErrors = scope.parameters.flatMap((parameter) => parameterErrors(parameter, scope.parameters));
  const updateParameter = (index: number, patch: Partial<ScopedParameter>) => {
    onChange({ ...scope, parameters: scope.parameters.map((parameter, i) => (i === index ? { ...parameter, ...patch } : parameter)) });
  };
  const removeParameter = (index: number) => onChange({ ...scope, parameters: scope.parameters.filter((_, i) => i !== index) });
  const toggleValueType = (index: number, value: ScopedParameter["value_types"][number], checked: boolean) => {
    const current = scope.parameters[index].value_types;
    updateParameter(index, { value_types: checked ? [...current, value] : current.filter((item) => item !== value) });
  };
  return (
    <div className="scope-panel" aria-label="Scoped extraction review">
      <h3 className="scope-title">Review scoped extraction plan</h3>
      {scope.parameters.map((parameter, index) => {
        const errors = parameterErrors(parameter, scope.parameters);
        return (
          <div className="scope-review-card" key={`${parameter.parameter_id}-${index}`}>
            <div className="scope-review-row">
              <label>Parameter ID<input aria-label="Parameter ID" className="editable-cell" value={parameter.parameter_id} onChange={(event) => updateParameter(index, { parameter_id: event.target.value.trim() })} /></label>
              <label>Display name<input aria-label="Parameter name" className="editable-cell" value={parameter.display_name} onChange={(event) => updateParameter(index, { display_name: event.target.value })} /></label>
              <button className="btn btn-secondary" onClick={() => removeParameter(index)}>Remove</button>
            </div>
            <label>Description<textarea aria-label="Parameter description" className="editable-cell" value={parameter.description} onChange={(event) => updateParameter(index, { description: event.target.value })} /></label>
            <div className="scope-review-row">
              <label>Expected units<textarea aria-label="Expected units" className="editable-cell" value={parameter.expected_units.join(", ")} onChange={(event) => updateParameter(index, { expected_units: parseList(event.target.value) })} /></label>
              <label>Synonyms<textarea aria-label="Synonyms" className="editable-cell" value={parameter.synonyms.join(", ")} onChange={(event) => updateParameter(index, { synonyms: parseList(event.target.value) })} /></label>
            </div>
            <fieldset className="scope-review-meta"><legend><strong>Value types</strong></legend>
              {VALUE_TYPES.map((value) => <label key={value} style={{ display: "inline-block", marginRight: 12 }}><input type="checkbox" checked={parameter.value_types.includes(value)} onChange={(event) => toggleValueType(index, value, event.target.checked)} /> {value}</label>)}
            </fieldset>
            <details className="scope-review-meta"><summary>Advanced evidence/review rules</summary><div><strong>Required evidence:</strong> {parameter.required_evidence.join(", ")}</div><div><strong>Review rules:</strong> {parameter.needs_review_rules.join(", ") || "None"}</div></details>
            {errors.length > 0 && <ul className="error-banner">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
          </div>
        );
      })}
      <div className="results-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => onChange({ ...scope, parameters: [...scope.parameters, blankParameter()] })}>Add parameter</button>
        <button className="btn btn-success" disabled={validationErrors.length > 0 || allParameterErrors.length > 0 || scope.parameters.length === 0} onClick={onApprove}>{approved ? "Scope approved" : "Approve scope"}</button>
      </div>
    </div>
  );
}
