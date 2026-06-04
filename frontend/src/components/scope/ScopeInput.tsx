interface ScopeInputProps {
  rawParameters: string;
  documentContext: string;
  loading: boolean;
  onRawParametersChange: (value: string) => void;
  onDocumentContextChange: (value: string) => void;
  onBuildScope: () => void;
}

export default function ScopeInput({ rawParameters, documentContext, loading, onRawParametersChange, onDocumentContextChange, onBuildScope }: ScopeInputProps) {
  const disabled = rawParameters.trim().length === 0 || loading;
  return (
    <div className="subsection-card" aria-label="Scoped extraction input">
      <div className="section-header compact">
        <span className="step-badge subtle">A</span>
        <div>
          <h3 className="section-title">Paste parameters</h3>
          <p className="section-description">Enter one parameter per line or paste a comma-separated list from your protocol.</p>
        </div>
      </div>
      <div className="form-field-group">
        <label className="input-label" htmlFor="scope-parameters">Parameters to extract</label>
        <textarea
          id="scope-parameters"
          className="scope-textarea"
          value={rawParameters}
          maxLength={10000}
          onChange={(event) => onRawParametersChange(event.target.value)}
          placeholder={"pH\nTemperature\nDissolved oxygen\nAgitation speed\nHarvest volume"}
        />
        <p className="helper-text">Required. Scope building uses this list to create reviewable extraction targets; missing parameters are reported once after all pages are compiled, not once per page.</p>
      </div>
      <div className="form-field-group">
        <label className="input-label" htmlFor="scope-context">Optional context</label>
        <textarea
          id="scope-context"
          className="scope-textarea scope-textarea-small"
          value={documentContext}
          maxLength={2000}
          onChange={(event) => onDocumentContextChange(event.target.value)}
          placeholder="Cell therapy manufacturing batch record; bioreactor section; units usually °C and %."
        />
        <p className="helper-text">Optional. Add document type, section names, or expected units to improve generated names and synonyms.</p>
      </div>
      <div className="action-bar compact-action-bar">
        <button className="btn btn-success" disabled={disabled} onClick={onBuildScope}>
          {loading ? "Building scope…" : "Build extraction scope"}
        </button>
      </div>
      {disabled && !loading && <p className="helper-text">Add at least one parameter to build a scope.</p>}
    </div>
  );
}
