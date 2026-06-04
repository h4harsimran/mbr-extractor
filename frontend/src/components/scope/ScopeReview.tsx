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
const PREVIEW_LIMIT = 3;

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

function previewList(values: string[], emptyLabel: string): string {
  if (values.length === 0) return emptyLabel;
  const visible = values.slice(0, PREVIEW_LIMIT).join(", ");
  const remaining = values.length - PREVIEW_LIMIT;
  return remaining > 0 ? `${visible} +${remaining} more` : visible;
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
  const parameterErrorSets = scope.parameters.map((parameter) => parameterErrors(parameter, scope.parameters));
  const allParameterErrors = parameterErrorSets.flat();
  const blockingErrors = [...allParameterErrors, ...validationErrors];
  const updateParameter = (index: number, patch: Partial<ScopedParameter>) => {
    onChange({ ...scope, parameters: scope.parameters.map((parameter, i) => (i === index ? { ...parameter, ...patch } : parameter)) });
  };
  const removeParameter = (index: number) => onChange({ ...scope, parameters: scope.parameters.filter((_, i) => i !== index) });
  const toggleValueType = (index: number, value: ScopedParameter["value_types"][number], checked: boolean) => {
    const current = scope.parameters[index].value_types;
    updateParameter(index, { value_types: checked ? [...current, value] : current.filter((item) => item !== value) });
  };
  const cannotApprove = blockingErrors.length > 0 || scope.parameters.length === 0;

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
          const errors = parameterErrorSets[index];
          return (
            <article className={`scope-review-card compact-parameter-card${errors.length > 0 ? " has-blocking-errors" : ""}`} key={`${parameter.parameter_id}-${index}`}>
              <div className="scope-card-heading compact-scope-heading">
                <div className="scope-parameter-identity">
                  <label className="input-label" htmlFor={`scope-display-${index}`}>Display name</label>
                  <input id={`scope-display-${index}`} aria-label="Display name" className="editable-cell scope-primary-input" value={parameter.display_name} onChange={(event) => updateParameter(index, { display_name: event.target.value })} />
                </div>
                <div className="scope-card-actions">
                  {errors.length > 0 && <span className="validation-problem-badge" aria-label="Validation problem">Needs fix</span>}
                  <button className="btn btn-secondary" onClick={() => removeParameter(index)}>Remove</button>
                </div>
              </div>

              <div className="compact-scope-row" aria-label={`${parameter.display_name} compact scope details`}>
                <div className="form-field-group compact-units-field">
                  <label className="input-label" htmlFor={`scope-units-${index}`}>Expected units</label>
                  <input id={`scope-units-${index}`} aria-label="Expected units" className="editable-cell" value={parameter.expected_units.join(", ")} placeholder="No expected units" onChange={(event) => updateParameter(index, { expected_units: parseList(event.target.value) })} />
                </div>
                <div className="compact-hint-preview">
                  <span className="input-label">Synonym/hint preview</span>
                  <span className="compact-preview-text">{previewList(parameter.synonyms, "No matching hints")}</span>
                </div>
              </div>

              {errors.length > 0 && <ul className="callout callout-error scope-error-list" aria-label="Blocking parameter errors">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}

              <details className="advanced-details compact-scope-details">
                <summary>Edit details</summary>
                <div className="scope-field-grid">
                  <div className="form-field-group template-controls-spaced">
                    <label className="parameter-id-label" htmlFor={`scope-id-${index}`}>Stable field ID</label>
                    <input id={`scope-id-${index}`} aria-label="Stable field ID" className="editable-cell parameter-id-input" value={parameter.parameter_id} onChange={(event) => updateParameter(index, { parameter_id: event.target.value.trim() })} />
                  </div>
                  <div className="form-field-group">
                    <label className="input-label" htmlFor={`scope-synonyms-${index}`}>Matching hints</label>
                    <textarea id={`scope-synonyms-${index}`} aria-label="Matching hints" className="editable-cell review-textarea small" value={parameter.synonyms.join(", ")} onChange={(event) => updateParameter(index, { synonyms: parseList(event.target.value) })} />
                  </div>
                </div>

                <div className="form-field-group">
                  <label className="input-label" htmlFor={`scope-description-${index}`}>Full description</label>
                  <textarea id={`scope-description-${index}`} aria-label="Full description" className="editable-cell review-textarea" value={parameter.description} onChange={(event) => updateParameter(index, { description: event.target.value })} />
                </div>

                <fieldset className="value-type-fieldset">
                  <legend>Results to capture</legend>
                  <div className="checkbox-wrap">
                    {VALUE_TYPES.map((value) => <label key={value} className="checkbox-pill"><input type="checkbox" checked={parameter.value_types.includes(value)} onChange={(event) => toggleValueType(index, value, event.target.checked)} /> {value.replace(/_/g, " ")}</label>)}
                  </div>
                </fieldset>

                <div className="scope-safeguards-grid" aria-label="Review safeguards">
                  <div><strong>Required evidence:</strong> {parameter.required_evidence.join(", ").replace(/_/g, " ")}</div>
                  <div><strong>Review rules:</strong> {(parameter.needs_review_rules.join(", ") || "None").replace(/_/g, " ")}</div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <div className="action-bar scope-approval-bar">
        <button className="btn btn-secondary" onClick={() => onChange({ ...scope, parameters: [...scope.parameters, blankParameter()] })}>Add parameter</button>
        <div className="approval-action">
          {cannotApprove && <p className="helper-text">Fix blocking scope issues before approval.</p>}
          {validationErrors.length > 0 && <ul className="callout callout-error scope-error-list" aria-label="Blocking scope errors">{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>}
          <button className="btn btn-success" disabled={cannotApprove} onClick={onApprove}>{approved ? "Scope approved" : "Approve scope"}</button>
        </div>
      </div>
    </div>
  );
}
