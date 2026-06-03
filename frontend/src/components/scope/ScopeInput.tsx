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
    <div className="scope-panel" aria-label="Scoped extraction input">
      <h3 className="scope-title">Define extraction scope</h3>
      <label className="input-label" htmlFor="scope-parameters">Parameters to extract</label>
      <textarea
        id="scope-parameters"
        className="scope-textarea"
        value={rawParameters}
        maxLength={10000}
        onChange={(event) => onRawParametersChange(event.target.value)}
        placeholder={"pH\nTemperature\nDissolved oxygen\nAgitation speed\nHarvest volume"}
      />
      <label className="input-label" htmlFor="scope-context">Optional document context</label>
      <textarea
        id="scope-context"
        className="scope-textarea scope-textarea-small"
        value={documentContext}
        maxLength={2000}
        onChange={(event) => onDocumentContextChange(event.target.value)}
        placeholder="Cell therapy manufacturing batch record; bioreactor section; units usually °C and %."
      />
      <button className="btn btn-success" disabled={disabled} onClick={onBuildScope}>
        {loading ? "Building scope…" : "Build extraction scope"}
      </button>
    </div>
  );
}
