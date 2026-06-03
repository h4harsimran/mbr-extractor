import { bytesToMb, extractionConfig } from "../config/extraction";
import type { UploadPreflight as UploadPreflightData } from "../types";

interface UploadPreflightProps {
  preflight: UploadPreflightData;
  onStart: () => void;
  onCancel: () => void;
}

export default function UploadPreflight({ preflight, onStart, onCancel }: UploadPreflightProps) {
  return (
    <div className="card card-lg fade-in">
      <h2 className="progress-title">Review extraction before starting</h2>
      <div className="results-summary" style={{ marginTop: 24 }}>
        <div className="stat-card"><div className="stat-value">{preflight.filename}</div><div className="stat-label">File</div></div>
        <div className="stat-card"><div className="stat-value">{bytesToMb(preflight.fileSizeBytes).toFixed(1)} MB</div><div className="stat-label">Size</div></div>
        <div className="stat-card"><div className="stat-value">{preflight.pageCount}</div><div className="stat-label">Pages</div></div>
        <div className="stat-card"><div className="stat-value">{preflight.pageCount}</div><div className="stat-label">Estimated API calls</div></div>
      </div>
      <div className="error-banner" style={{ marginTop: 24, borderColor: "var(--warning)", color: "var(--warning)" }}>
        Human review is required. This app does not store uploaded PDFs or extracted rows, but page images are sent to Gemini for AI extraction.
      </div>
      <p className="upload-hint" style={{ marginTop: 16 }}>
        Limits: {extractionConfig.maxPages} pages, {extractionConfig.maxFileSizeMb} MB, concurrency {extractionConfig.concurrency}.
      </p>
      <div className="results-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Choose another file</button>
        <button className="btn btn-success" onClick={onStart}>Start extraction</button>
      </div>
    </div>
  );
}
