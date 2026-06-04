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
  const cannotApprove = validationErrors.length > 0 || allParameterErrors.length > 0 || scope.parameters.length === 0;

  return (
    <div className="subsection-card" aria-label="Scoped extraction review">
      <div className="section-header compact">
        <span className="step-badge subtle">C</span>
        <div>
          <h3 className="section-title">Compact scope preview</h3>
          <p className="section-description">Confirm the field list that will shape your results. Open a field only when you need to edit details.</p>
        </div>
      </div>
      <div className="scope-parameter-list">
        {scope.parameters.map((parameter, index) => {
          const errors = parameterErrors(parameter, scope.parameters);
          return (
            <article className="scope-review-card" key={`${parameter.parameter_id}-${index}`}>
              <div className="scope-card-heading compact-scope-heading">
                <div className="scope-parameter-identity">
                  <label className="input-label" htmlFor={`scope-display-${index}`}>Result field</label>
                  <input id={`scope-display-${index}`} aria-label="Result field" className="editable-cell scope-primary-input" value={parameter.display_name} onChange={(event) => updateParameter(index, { display_name: event.target.value })} />
                </div>
                <button className="btn btn-secondary" onClick={() => removeParameter(index)}>Remove</button>
              </div>

              <div className="compact-scope-summary" aria-label={`${parameter.display_name} scope summary`}>
                <span>{parameter.value_types.length} result type{parameter.value_types.length === 1 ? "" : "s"}</span>
                <span>{parameter.expected_units.length > 0 ? `Units: ${parameter.expected_units.join(", ")}` : "No expected units"}</span>
                <span>{parameter.synonyms.length > 0 ? `${parameter.synonyms.length} matching hint${parameter.synonyms.length === 1 ? "" : "s"}` : "No matching hints"}</span>
              </div>

              <details className="advanced-details compact-scope-details">
                <summary>Edit field details</summary>
                <div className="form-field-group">
                  <label className="input-label" htmlFor={`scope-description-${index}`}>What to extract</label>
                  <textarea id={`scope-description-${index}`} aria-label="What to extract" className="editable-cell review-textarea" value={parameter.description} onChange={(event) => updateParameter(index, { description: event.target.value })} />
                </div>

                <div className="scope-field-grid">
                  <div className="form-field-group">
                    <label className="input-label" htmlFor={`scope-units-${index}`}>Expected units</label>
                    <textarea id={`scope-units-${index}`} aria-label="Expected units" className="editable-cell review-textarea small" value={parameter.expected_units.join(", ")} onChange={(event) => updateParameter(index, { expected_units: parseList(event.target.value) })} />
                  </div>
                  <div className="form-field-group">
                    <label className="input-label" htmlFor={`scope-synonyms-${index}`}>Matching hints</label>
                    <textarea id={`scope-synonyms-${index}`} aria-label="Matching hints" className="editable-cell review-textarea small" value={parameter.synonyms.join(", ")} onChange={(event) => updateParameter(index, { synonyms: parseList(event.target.value) })} />
                  </div>
                </div>

                <fieldset className="value-type-fieldset">
                  <legend>Results to capture</legend>
                  <div className="checkbox-wrap">
                    {VALUE_TYPES.map((value) => <label key={value} className="checkbox-pill"><input type="checkbox" checked={parameter.value_types.includes(value)} onChange={(event) => toggleValueType(index, value, event.target.checked)} /> {value.replace(/_/g, " ")}</label>)}
                  </div>
                </fieldset>

                <details className="advanced-details">
                  <summary>Show review safeguards</summary>
                  <div><strong>Evidence shown:</strong> {parameter.required_evidence.join(", ").replace(/_/g, " ")}</div>
                  <div><strong>Flag for review:</strong> {(parameter.needs_review_rules.join(", ") || "None").replace(/_/g, " ")}</div>
                  <div className="form-field-group template-controls-spaced">
                    <label className="parameter-id-label" htmlFor={`scope-id-${index}`}>Stable field ID</label>
                    <input id={`scope-id-${index}`} aria-label="Stable field ID" className="editable-cell parameter-id-input" value={parameter.parameter_id} onChange={(event) => updateParameter(index, { parameter_id: event.target.value.trim() })} />
                  </div>
                </details>
              </details>
              {errors.length > 0 && <ul className="callout callout-error scope-error-list" aria-label="Parameter errors">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
            </article>
          );
        })}
      </div>
      <div className="action-bar scope-approval-bar">
        <button className="btn btn-secondary" onClick={() => onChange({ ...scope, parameters: [...scope.parameters, blankParameter()] })}>Add parameter</button>
        <div className="approval-action">
          {cannotApprove && <p className="helper-text">Fix the highlighted fields before approval.</p>}
          <button className="btn btn-success" disabled={cannotApprove} onClick={onApprove}>{approved ? "Scope approved" : "Approve scope"}</button>
        </div>
      </div>
    </div>
  );
}
