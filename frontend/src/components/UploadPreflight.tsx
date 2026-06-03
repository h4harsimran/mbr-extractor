import { bytesToMb, extractionConfig } from "../config/extraction";
import type { ExtractionMode, ScopedExtractionPlan, UploadPreflight as UploadPreflightData } from "../types";
import ScopeInput from "./scope/ScopeInput";
import ScopeModeSelector from "./scope/ScopeModeSelector";
import ScopeReview from "./scope/ScopeReview";

interface UploadPreflightProps {
  preflight: UploadPreflightData;
  extractionMode: ExtractionMode;
  rawParameters: string;
  documentContext: string;
  scopedPlan: ScopedExtractionPlan | null;
  scopeApproved: boolean;
  scopeLoading: boolean;
  scopeWarnings: string[];
  onModeChange: (mode: ExtractionMode) => void;
  onRawParametersChange: (value: string) => void;
  onDocumentContextChange: (value: string) => void;
  onBuildScope: () => void;
  onScopeChange: (scope: ScopedExtractionPlan) => void;
  onApproveScope: () => void;
  onStart: () => void;
  onCancel: () => void;
}

export default function UploadPreflight({
  preflight,
  extractionMode,
  rawParameters,
  documentContext,
  scopedPlan,
  scopeApproved,
  scopeLoading,
  scopeWarnings,
  onModeChange,
  onRawParametersChange,
  onDocumentContextChange,
  onBuildScope,
  onScopeChange,
  onApproveScope,
  onStart,
  onCancel,
}: UploadPreflightProps) {
  const canStart = extractionMode === "full" || (Boolean(scopedPlan) && scopeApproved);
  return (
    <div className="card card-lg fade-in">
      <h2 className="progress-title">Review extraction before starting</h2>
      <div className="results-summary" style={{ marginTop: 24 }}>
        <div className="stat-card"><div className="stat-value">{preflight.filename}</div><div className="stat-label">File</div></div>
        <div className="stat-card"><div className="stat-value">{bytesToMb(preflight.fileSizeBytes).toFixed(1)} MB</div><div className="stat-label">Size</div></div>
        <div className="stat-card"><div className="stat-value">{preflight.pageCount}</div><div className="stat-label">Pages</div></div>
        <div className="stat-card"><div className="stat-value">{preflight.pageCount + (extractionMode === "scoped" ? 1 : 0)}</div><div className="stat-label">Estimated API calls</div></div>
      </div>
      <ScopeModeSelector mode={extractionMode} onChange={onModeChange} />
      {extractionMode === "scoped" && (
        <>
          <ScopeInput rawParameters={rawParameters} documentContext={documentContext} loading={scopeLoading} onRawParametersChange={onRawParametersChange} onDocumentContextChange={onDocumentContextChange} onBuildScope={onBuildScope} />
          {scopeWarnings.map((warning) => <div className="error-banner" key={warning} style={{ marginTop: 12 }}>{warning}</div>)}
          {scopedPlan && <ScopeReview scope={scopedPlan} approved={scopeApproved} onChange={onScopeChange} onApprove={onApproveScope} />}
        </>
      )}
      <div className="error-banner" style={{ marginTop: 24, borderColor: "var(--warning)", color: "var(--warning)" }}>
        Human review is required. This app does not store uploaded PDFs or extracted rows, but page images are sent to Gemini for AI extraction.
      </div>
      <p className="upload-hint" style={{ marginTop: 16 }}>
        Limits: {extractionConfig.maxPages} pages, {extractionConfig.maxFileSizeMb} MB, concurrency {extractionConfig.concurrency}.
      </p>
      <div className="results-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Choose another file</button>
        <button className="btn btn-success" disabled={!canStart} onClick={onStart}>Start extraction</button>
      </div>
    </div>
  );
}
