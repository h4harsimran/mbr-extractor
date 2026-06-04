import { useEffect, useState } from "react";
import type { ExtractedRow, ExtractionMode, ReviewStatus, ScopedExtractionResult } from "../../types";

export type ReviewField = keyof ExtractedRow;
export type ScopedReviewField = keyof ScopedExtractionResult;

type FullRow = ExtractedRow & { rowIdx: number; kind: "full" };
type ScopedRow = ScopedExtractionResult & { rowIdx: number; page_number: number; kind: "scoped" };
export type ReviewRow = FullRow | ScopedRow;

function Editable({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input aria-label="Review editable field" className="editable-cell" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onCommit(draft)} />;
}

function scopedStatus(row: ScopedRow): string {
  if (row.review_status === "not_applicable") return "Not applicable";
  if (row.needs_review) return "Needs review";
  if (row.review_status === "accepted") return "Accepted";
  return "OK";
}

interface Props {
  mode: ExtractionMode;
  pageNumber: number;
  rows: ReviewRow[];
  selectedRowIndex: number | null;
  onSelectRow: (rowIndex: number) => void;
  onUpdateFullRow: (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean | number) => void;
  onUpdateScopedRow: (pageNumber: number, rowIndex: number, field: keyof ScopedExtractionResult, value: string | boolean | number | string[] | ReviewStatus | null) => void;
  onRetryPage: (pageNumber: number) => void;
}

export default function PageRowsPanel({ mode, pageNumber, rows, selectedRowIndex, onSelectRow, onUpdateFullRow, onUpdateScopedRow, onRetryPage }: Props) {
  const selected = rows.find((row) => row.rowIdx === selectedRowIndex) ?? rows[0];
  const setReview = (value: boolean) => {
    if (!selected) return;
    if (selected.kind === "full") onUpdateFullRow(pageNumber, selected.rowIdx, "needs_review", value);
    else {
      onUpdateScopedRow(pageNumber, selected.rowIdx, "needs_review", value);
      onUpdateScopedRow(pageNumber, selected.rowIdx, "review_status", value ? "open" : "accepted");
    }
  };
  const markNotApplicable = () => {
    if (selected?.kind !== "scoped") return;
    onUpdateScopedRow(pageNumber, selected.rowIdx, "needs_review", false);
    onUpdateScopedRow(pageNumber, selected.rowIdx, "review_status", "not_applicable");
  };
  return (
    <section className="review-rows-panel" aria-label="Extracted rows for selected page">
      <div className="review-toolbar"><h3>Rows on page {pageNumber}</h3><button className="btn btn-secondary" onClick={() => onRetryPage(pageNumber)}>Retry page</button></div>
      {rows.length === 0 ? <div className="empty-state">{mode === "scoped" ? "No scoped parameters found on this page." : "No extracted rows are available for this page."}</div> : <div className="review-row-list">
        {rows.map((row) => (
          <button key={`${row.kind}-${row.rowIdx}`} className={`review-row-card ${selected?.rowIdx === row.rowIdx ? "selected" : ""}`} onClick={() => onSelectRow(row.rowIdx)}>
            <strong>{row.kind === "full" ? row.parameter_label ?? "Unnamed parameter" : row.display_name}</strong>
            <span>{(row.extraction_confidence * 100).toFixed(0)}% confidence</span>
            <span>{row.kind === "scoped" ? scopedStatus(row) : row.needs_review ? "Needs review" : "OK"}</span>
          </button>
        ))}
      </div>}
      {selected && (
        <div className="review-detail-card">
          <h4>{selected.kind === "full" ? selected.parameter_label ?? "Unnamed parameter" : selected.display_name}</h4>
          {mode === "scoped" && selected.kind === "scoped" && <div className="scope-review-meta"><strong>Status:</strong> {scopedStatus(selected)}</div>}
          <label>Target<Editable value={selected.target_value ?? ""} onCommit={(value) => selected.kind === "full" ? onUpdateFullRow(pageNumber, selected.rowIdx, "target_value", value) : onUpdateScopedRow(pageNumber, selected.rowIdx, "target_value", value)} /></label>
          <label>Actual<Editable value={selected.actual_value ?? ""} onCommit={(value) => selected.kind === "full" ? onUpdateFullRow(pageNumber, selected.rowIdx, "actual_value", value) : onUpdateScopedRow(pageNumber, selected.rowIdx, "actual_value", value)} /></label>
          <label>Units<Editable value={selected.units ?? ""} onCommit={(value) => selected.kind === "full" ? onUpdateFullRow(pageNumber, selected.rowIdx, "units", value) : onUpdateScopedRow(pageNumber, selected.rowIdx, "units", value)} /></label>
          {selected.kind === "scoped" && <label>Source label<Editable value={selected.source_label ?? ""} onCommit={(value) => onUpdateScopedRow(pageNumber, selected.rowIdx, "source_label", value)} /></label>}
          <div className="scope-review-meta"><strong>Confidence:</strong> {(selected.extraction_confidence * 100).toFixed(0)}%</div>
          <div className="scope-review-meta"><strong>Review reasons/warnings:</strong> {selected.kind === "full" ? selected.warnings?.map((w) => w.message || w.code).join("; ") || selected.review_reason || "None" : selected.review_reasons.join("; ") || "None"}</div>
          {selected.kind === "scoped" && <div className="evidence-box"><strong>Nearby text:</strong><br />{selected.nearby_text || "No nearby text returned."}</div>}
          <div className="results-actions review-detail-actions">
            <button className="btn btn-success" onClick={() => setReview(false)}>Accept / Clear review</button>
            <button className="btn btn-secondary" onClick={() => setReview(true)}>Mark review needed</button>
            {selected.kind === "scoped" && <button className="btn btn-secondary" onClick={markNotApplicable}>Mark N/A</button>}
          </div>
        </div>
      )}
    </section>
  );
}
