import type { ExtractionMode } from "../../types";

export default function ScopeModeSelector({ mode, onChange }: { mode: ExtractionMode; onChange: (mode: ExtractionMode) => void }) {
  return (
    <fieldset className="scope-panel">
      <legend className="scope-title">Extraction Mode</legend>
      <label className="scope-option">
        <input type="radio" name="extraction-mode" checked={mode === "full"} onChange={() => onChange("full")} />
        <span><strong>Full extraction</strong><br />Extract all relevant MBR rows from each page.</span>
      </label>
      <label className="scope-option">
        <input type="radio" name="extraction-mode" checked={mode === "scoped"} onChange={() => onChange("scoped")} />
        <span><strong>Scoped extraction</strong><br />Extract only the parameters you define and approve.</span>
      </label>
    </fieldset>
  );
}
