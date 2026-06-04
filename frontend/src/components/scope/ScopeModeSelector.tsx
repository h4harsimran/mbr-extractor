import type { ExtractionMode } from "../../types";

export default function ScopeModeSelector({ mode, onChange }: { mode: ExtractionMode; onChange: (mode: ExtractionMode) => void }) {
  return (
    <fieldset className="mode-selector" aria-label="Extraction mode">
      <legend className="sr-only">Extraction mode</legend>
      <label className={`mode-option-card ${mode === "full" ? "selected" : ""}`}>
        <input type="radio" name="extraction-mode" checked={mode === "full"} onChange={() => onChange("full")} />
        <span className="mode-option-content">
          <span className="mode-option-title">Full extraction</span>
          <span className="mode-option-description">Extract all relevant MBR rows from every page. Recommended for most PDFs.</span>
        </span>
      </label>
      <label className={`mode-option-card ${mode === "scoped" ? "selected" : ""}`}>
        <input type="radio" name="extraction-mode" checked={mode === "scoped"} onChange={() => onChange("scoped")} />
        <span className="mode-option-content">
          <span className="mode-option-title">Scoped extraction</span>
          <span className="mode-option-description">Scoped extraction finds requested parameters wherever they appear in the document. Pages without a requested parameter will not create missing rows; after extraction, results are compiled by your scope order and any parameters not found anywhere are shown once.</span>
        </span>
      </label>
    </fieldset>
  );
}
