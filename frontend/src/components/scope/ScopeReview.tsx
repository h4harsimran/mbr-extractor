import type { ScopedExtractionPlan, ScopedParameter } from "../../types";

interface ScopeReviewProps {
  scope: ScopedExtractionPlan;
  approved: boolean;
  onChange: (scope: ScopedExtractionPlan) => void;
  onApprove: () => void;
}

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

export default function ScopeReview({ scope, approved, onChange, onApprove }: ScopeReviewProps) {
  const updateParameter = (index: number, patch: Partial<ScopedParameter>) => {
    onChange({ ...scope, parameters: scope.parameters.map((parameter, i) => (i === index ? { ...parameter, ...patch } : parameter)) });
  };
  const removeParameter = (index: number) => {
    onChange({ ...scope, parameters: scope.parameters.filter((_, i) => i !== index) });
  };
  return (
    <div className="scope-panel" aria-label="Scoped extraction review">
      <h3 className="scope-title">Review scoped extraction plan</h3>
      {scope.parameters.map((parameter, index) => (
        <div className="scope-review-card" key={parameter.parameter_id}>
          <div className="scope-review-row">
            <input aria-label="Parameter name" className="editable-cell" value={parameter.display_name} onChange={(event) => updateParameter(index, { display_name: event.target.value })} />
            <button className="btn btn-secondary" onClick={() => removeParameter(index)}>Remove</button>
          </div>
          <div className="scope-review-meta"><strong>Units:</strong> {parameter.expected_units.join(", ") || "Any"}</div>
          <div className="scope-review-meta"><strong>Synonyms:</strong> {parameter.synonyms.join(", ") || "None"}</div>
          <div className="scope-review-meta"><strong>Value types:</strong> {parameter.value_types.join(", ")}</div>
        </div>
      ))}
      <div className="results-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => onChange({ ...scope, parameters: [...scope.parameters, blankParameter()] })}>Add parameter</button>
        <button className="btn btn-success" disabled={scope.parameters.length === 0} onClick={onApprove}>{approved ? "Scope approved" : "Approve scope"}</button>
      </div>
    </div>
  );
}
