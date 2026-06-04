import type { ExtractionMode } from "../../types";

export default function ScopeModeSelector({ mode, onChange }: { mode: ExtractionMode; onChange: (mode: ExtractionMode) => void }) {
  return (
    <fieldset className="mode-selector" aria-label="Extraction mode">
      <legend className="sr-only">Extraction mode</legend>
      <label className={`mode-option-card ${mode === "full" ? "selected" : ""}`}>
        <input type="radio" name="extraction-mode" checked={mode === "full"} onChange={() => onChange("full")} />
        <span className="mode-option-content">
          <span className="mode-option-title">Full extraction</span>
          <span className="mode-option-description">Extract every relevant MBR row from the PDF. Recommended when you want the broadest results.</span>
        </span>
      </label>
      <label className={`mode-option-card ${mode === "scoped" ? "selected" : ""}`}>
        <input type="radio" name="extraction-mode" checked={mode === "scoped"} onChange={() => onChange("scoped")} />
        <span className="mode-option-content">
          <span className="mode-option-title">Scoped extraction</span>
          <span className="mode-option-description">Extract only the fields you list, then review missing or low-confidence matches.</span>
        </span>
      </label>
    </fieldset>
  );
}
