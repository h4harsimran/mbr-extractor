import { useEffect, useRef, useState } from "react";
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

const reviewNeeded = (row: ReviewRow) => {
  if (row.kind === "full") return row.needs_review;
  return row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable";
};

const reviewReason = (row: ReviewRow) => row.kind === "full"
  ? row.warnings?.map((warning) => warning.message || warning.code).join("; ") || row.review_reason || "No review reason provided."
  : row.review_reasons.join("; ") || "No review reason provided.";

interface Props {
  mode: ExtractionMode;
  pageNumber: number;
  rows: ReviewRow[];
  selectedRowIndex: number | null;
  queueDrivenReview?: boolean;
  onSelectRow: (rowIndex: number) => void;
  onUpdateFullRow: (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean | number) => void;
  onUpdateScopedRow: (pageNumber: number, rowIndex: number, field: keyof ScopedExtractionResult, value: string | boolean | number | string[] | ReviewStatus | null) => void;
  onRetryPage: (pageNumber: number) => void;
  onAcceptAndNext?: (row: ReviewRow) => void;
  onSkipForNow?: (row: ReviewRow) => void;
}

export default function PageRowsPanel({ mode, pageNumber, rows, selectedRowIndex, queueDrivenReview = false, onSelectRow, onUpdateFullRow, onUpdateScopedRow, onRetryPage, onAcceptAndNext, onSkipForNow }: Props) {
  const [showAllRows, setShowAllRows] = useState(false);
  const rowButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const reviewRows = rows.filter(reviewNeeded);
  const visibleRows = showAllRows ? rows : reviewRows;
  const selected = rows.find((row) => row.rowIdx === selectedRowIndex) ?? visibleRows[0];
  const selectedIsHidden = selected ? !visibleRows.some((row) => row.rowIdx === selected.rowIdx) : false;
  const displayedRows = selected && selectedIsHidden ? [selected, ...visibleRows] : visibleRows;

  useEffect(() => {
    if (queueDrivenReview && selectedRowIndex !== null) {
      rowButtonRefs.current[selectedRowIndex]?.focus();
    }
  }, [queueDrivenReview, selectedRowIndex, pageNumber, showAllRows]);

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
      <div className="review-toolbar">
        <div>
          <h3>Rows on page {pageNumber}</h3>
          <p className="scope-review-meta">{showAllRows ? "Showing all rows on this page." : "Showing only rows that need review by default for faster queue review."}</p>
        </div>
        <div className="review-toolbar-actions">
          <label className="review-toggle"><input type="checkbox" checked={showAllRows} onChange={(event) => setShowAllRows(event.target.checked)} />Show all rows on this page</label>
          <button className="btn btn-secondary" onClick={() => onRetryPage(pageNumber)}>Retry page</button>
        </div>
      </div>
      {rows.length === 0 ? <div className="empty-state">{mode === "scoped" ? "No scoped parameters found on this page." : "No extracted rows are available for this page."}</div> : displayedRows.length === 0 ? <div className="empty-state">No rows on this page currently need review. Turn on “Show all rows on this page” to inspect accepted or OK rows.</div> : <div className="review-row-list">
        {displayedRows.map((row) => {
          const isSelected = selected?.rowIdx === row.rowIdx;
          return (
            <button key={`${row.kind}-${row.rowIdx}`} ref={(element) => { rowButtonRefs.current[row.rowIdx] = element; }} className={`review-row-card ${isSelected ? "selected" : ""} ${queueDrivenReview && isSelected ? "queue-focused" : ""}`} onClick={() => onSelectRow(row.rowIdx)}>
              <strong>{row.kind === "full" ? row.parameter_label ?? "Unnamed parameter" : row.display_name}</strong>
              <span>{row.kind === "scoped" ? `Source: ${row.source_label || "Not returned"}` : `Page ${row.page_number}`}</span>
              <span>{(row.extraction_confidence * 100).toFixed(0)}% confidence · Page {row.page_number}</span>
              <span>{row.kind === "scoped" ? scopedStatus(row) : row.needs_review ? "Needs review" : "OK"}</span>
            </button>
          );
        })}
      </div>}
      {selected && (
        <div className="review-detail-card">
          <p className="eyebrow">{queueDrivenReview ? "Queue-selected row" : "Selected row"}</p>
          <h4>{selected.kind === "full" ? selected.parameter_label ?? "Unnamed parameter" : selected.display_name}</h4>
          <div className="evidence-grid" aria-label="Primary evidence">
            <div><strong>Source label</strong><span>{selected.kind === "scoped" ? selected.source_label || "Not returned" : selected.parameter_label || "Not returned"}</span></div>
            <div><strong>Confidence</strong><span>{(selected.extraction_confidence * 100).toFixed(0)}%</span></div>
            <div><strong>Page</strong><span>{selected.page_number}</span></div>
            <div className="evidence-grid-wide"><strong>Nearby text</strong><span>{selected.kind === "scoped" ? selected.nearby_text || "No nearby text returned." : selected.comments || "No nearby text returned."}</span></div>
          </div>
          <div className="review-reason-callout"><strong>Review reason:</strong> {reviewReason(selected)}</div>
          {mode === "scoped" && selected.kind === "scoped" && <div className="scope-review-meta"><strong>Status:</strong> {scopedStatus(selected)}</div>}
          <div className="editable-review-fields" aria-label="Editable extracted fields">
            <label>Target<Editable value={selected.target_value ?? ""} onCommit={(value) => selected.kind === "full" ? onUpdateFullRow(pageNumber, selected.rowIdx, "target_value", value) : onUpdateScopedRow(pageNumber, selected.rowIdx, "target_value", value)} /></label>
            <label>Actual<Editable value={selected.actual_value ?? ""} onCommit={(value) => selected.kind === "full" ? onUpdateFullRow(pageNumber, selected.rowIdx, "actual_value", value) : onUpdateScopedRow(pageNumber, selected.rowIdx, "actual_value", value)} /></label>
            <label>Units<Editable value={selected.units ?? ""} onCommit={(value) => selected.kind === "full" ? onUpdateFullRow(pageNumber, selected.rowIdx, "units", value) : onUpdateScopedRow(pageNumber, selected.rowIdx, "units", value)} /></label>
            {selected.kind === "scoped" && <label>Source label<Editable value={selected.source_label ?? ""} onCommit={(value) => onUpdateScopedRow(pageNumber, selected.rowIdx, "source_label", value)} /></label>}
          </div>
          <div className="results-actions review-detail-actions">
            {queueDrivenReview && onAcceptAndNext && <button className="btn btn-success" onClick={() => onAcceptAndNext(selected)}>Accept and next</button>}
            {queueDrivenReview && onSkipForNow && <button className="btn btn-secondary" onClick={() => onSkipForNow(selected)}>Skip for now</button>}
            <button className="btn btn-success" onClick={() => setReview(false)}>Accept / Clear review</button>
            <button className="btn btn-secondary" onClick={() => setReview(true)}>Mark review needed</button>
            {selected.kind === "scoped" && <button className="btn btn-secondary" onClick={markNotApplicable}>Mark N/A</button>}
          </div>
        </div>
      )}
    </section>
  );
}
