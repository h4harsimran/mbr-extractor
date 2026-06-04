import { bytesToMb, extractionConfig } from "../config/extraction";
import { validateScopedExtractionPlan } from "../lib/scope-validation";
import type { ExtractionMode, ScopedExtractionPlan, UploadPreflight as UploadPreflightData } from "../types";
import ScopeInput from "./scope/ScopeInput";
import ScopeModeSelector from "./scope/ScopeModeSelector";
import ScopeReview from "./scope/ScopeReview";
import ScopeTemplateManager from "./scope/ScopeTemplateManager";

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
  onLoadTemplateScope: (scope: ScopedExtractionPlan) => void;
  onStart: () => void;
  onCancel: () => void;
}

function StepHeader({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="section-header">
      <span className="step-badge">{step}</span>
      <div>
        <h3 className="section-title">{title}</h3>
        <p className="section-description">{description}</p>
      </div>
    </div>
  );
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
  onLoadTemplateScope,
  onStart,
  onCancel,
}: UploadPreflightProps) {
  const validation = scopedPlan ? validateScopedExtractionPlan(scopedPlan) : { valid: false, errors: ["No scope has been built or loaded."] };
  const canStart = extractionMode === "full" || (Boolean(scopedPlan) && scopeApproved && validation.valid);
  const estimatedCalls = preflight.pageCount + (extractionMode === "scoped" ? 1 : 0);

  return (
    <div className="preflight-container fade-in">
      <div className="preflight-hero">
        <p className="eyebrow">Ready to extract</p>
        <h2 className="progress-title">Review extraction setup</h2>
        <p className="section-description">
          Choose how much to extract, provide a scope when needed, then review the fields before starting.
        </p>
      </div>

      <section className="section-card" aria-labelledby="file-summary-heading">
        <div className="section-header">
          <div>
            <h3 className="section-title" id="file-summary-heading">File summary</h3>
            <p className="section-description">Confirm this is the document you want to process.</p>
          </div>
        </div>
        <div className="metadata-grid compact-metadata-grid" aria-label="PDF summary">
          <div className="metadata-item metadata-item-wide">
            <span className="metadata-label">File</span>
            <span className="metadata-value metadata-filename" title={preflight.filename}>{preflight.filename}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Size</span>
            <span className="metadata-value">{bytesToMb(preflight.fileSizeBytes).toFixed(1)} MB</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Pages</span>
            <span className="metadata-value">{preflight.pageCount}</span>
          </div>
        </div>
        <details className="advanced-details preflight-details">
          <summary>Show processing estimate</summary>
          <p>Estimated API calls: <strong>{estimatedCalls}</strong>. The estimate includes one call per page{extractionMode === "scoped" ? " plus one setup call for your reviewed scope" : ""}.</p>
        </details>
      </section>

      <section className="section-card" aria-labelledby="mode-heading">
        <StepHeader step={1} title="Choose mode" description="Pick full extraction for everything, or scoped extraction when you only need selected fields." />
        <ScopeModeSelector mode={extractionMode} onChange={onModeChange} />
      </section>

      {extractionMode === "scoped" && (
        <section className="section-card scoped-setup" aria-labelledby="scoped-setup-heading">
          <StepHeader step={2} title="Provide scope" description="Paste the fields you need, then optionally load a saved template or starter example." />
          <div className="scoped-setup-stack">
            <ScopeInput rawParameters={rawParameters} documentContext={documentContext} loading={scopeLoading} onRawParametersChange={onRawParametersChange} onDocumentContextChange={onDocumentContextChange} onBuildScope={onBuildScope} />
            {scopeWarnings.map((warning) => <div className="callout callout-warning" key={warning}>{warning}</div>)}
            <ScopeTemplateManager currentScope={scopedPlan} onLoadScope={onLoadTemplateScope} />
          </div>
        </section>
      )}

      <section className="section-card action-section" aria-label="Final extraction action">
        <StepHeader step={3} title={extractionMode === "scoped" ? "Review scope and start" : "Review and start"} description={extractionMode === "scoped" ? "Check the generated field list, approve it, then extract only those fields." : "Start when this file and mode look right."} />
        {extractionMode === "scoped" && scopedPlan && (
          <div className="scope-review-stage">
            {!validation.valid && <div className="callout callout-error"><strong>Scope needs attention.</strong><ul>{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            <ScopeReview scope={scopedPlan} approved={scopeApproved} validationErrors={validation.errors} onChange={onScopeChange} onApprove={onApproveScope} />
          </div>
        )}
        {extractionMode === "scoped" && !scopedPlan && <p className="helper-text">Paste parameters or load a template to preview your scoped field list here.</p>}
        <details className="advanced-details preflight-details">
          <summary>Show extraction limits</summary>
          <p>Files can include up to {extractionConfig.maxPages} pages and {extractionConfig.maxFileSizeMb} MB. Human review is still required before using extracted data.</p>
        </details>
        <p className="helper-text">Uploaded PDFs and extracted rows are not stored by this app. Page images are sent for extraction only after you start.</p>
        {extractionMode === "scoped" && !canStart && <p className="helper-text">Approve a valid scope to enable scoped extraction.</p>}
        <div className="action-bar">
          <button className="btn btn-secondary" onClick={onCancel}>Choose another file</button>
          <button className="btn btn-success" disabled={!canStart} onClick={onStart}>{extractionMode === "scoped" ? "Start scoped extraction" : "Start full extraction"}</button>
        </div>
      </section>
    </div>
  );
}
