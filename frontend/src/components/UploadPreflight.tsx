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
          Full extraction is the default path. Choose scoped extraction only when you want to limit results to an approved parameter list.
        </p>
      </div>

      <section className="section-card" aria-labelledby="file-summary-heading">
        <StepHeader step={1} title="File summary" description="Confirm the document and extraction estimate before API processing starts." />
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
          <div className="metadata-item">
            <span className="metadata-label">Estimated calls</span>
            <span className="metadata-value">{estimatedCalls}</span>
          </div>
        </div>
      </section>

      <section className="section-card" aria-labelledby="mode-heading">
        <StepHeader step={2} title="Extraction mode" description="Use full extraction for the fastest setup, or scoped extraction for an advanced, targeted run." />
        <ScopeModeSelector mode={extractionMode} onChange={onModeChange} />
      </section>

      {extractionMode === "scoped" && (
        <section className="section-card scoped-setup" aria-labelledby="scoped-setup-heading">
          <StepHeader step={3} title="Scoped setup" description="Create or load a parameter scope, then review and approve it before extraction." />
          <div className="scoped-setup-grid">
            <div className="scoped-primary-path">
              <ScopeInput rawParameters={rawParameters} documentContext={documentContext} loading={scopeLoading} onRawParametersChange={onRawParametersChange} onDocumentContextChange={onDocumentContextChange} onBuildScope={onBuildScope} />
              {scopeWarnings.map((warning) => <div className="callout callout-warning" key={warning}>{warning}</div>)}
            </div>
            <aside className="scoped-alternative" aria-label="Alternative scoped setup path">
              <p className="eyebrow">Alternative path</p>
              <ScopeTemplateManager currentScope={scopedPlan} onLoadScope={onLoadTemplateScope} />
            </aside>
          </div>
          {scopedPlan && (
            <div className="scope-review-stage">
              {!validation.valid && <div className="callout callout-error"><strong>Scope validation needs attention.</strong><ul>{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              <ScopeReview scope={scopedPlan} approved={scopeApproved} validationErrors={validation.errors} onChange={onScopeChange} onApprove={onApproveScope} />
            </div>
          )}
        </section>
      )}

      <section className="section-card action-section" aria-label="Final extraction action">
        <StepHeader step={extractionMode === "scoped" ? 4 : 3} title="Start extraction" description="Uploaded PDFs and extracted rows are not stored by this app. Rendered page images are sent to Gemini for extraction only after you start." />
        <div className="callout callout-info">
          Limits: {extractionConfig.maxPages} pages, {extractionConfig.maxFileSizeMb} MB, concurrency {extractionConfig.concurrency}. Human review is still required before using extracted data.
        </div>
        {extractionMode === "scoped" && !canStart && <p className="helper-text">Build or load a valid scope, then approve it to enable scoped extraction.</p>}
        <div className="action-bar">
          <button className="btn btn-secondary" onClick={onCancel}>Choose another file</button>
          <button className="btn btn-success" disabled={!canStart} onClick={onStart}>{extractionMode === "scoped" ? "Start scoped extraction" : "Start full extraction"}</button>
        </div>
      </section>
    </div>
  );
}
