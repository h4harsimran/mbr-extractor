import { useEffect, useMemo, useRef, useState } from "react";
import ScopedExtractionSummary from "./scope/ScopedExtractionSummary";
import ReviewQueue from "./review/ReviewQueue";
import ReviewWorkspace from "./review/ReviewWorkspace";
import { buildCSV, buildScopedCSV, downloadCSV } from "../lib/csv-builder";
import { compileScopedResults } from "../lib/compile-scoped-results";
import type { ExtractedRow, ExtractionMode, PageExtraction, PagePreview, PageProgress, ReviewStatus, ScopedDocumentReviewStatus, ScopedExtractionPlan, ScopedExtractionResult, ScopedSelectedMatch, ScopedPageExtraction } from "../types";

interface ResultsViewProps {
  pages: PageExtraction[];
  scopedPages: ScopedPageExtraction[];
  extractionMode: ExtractionMode;
  allPages: PageProgress[];
  pagePreviews: PagePreview[];
  filename: string;
  failedCount: number;
  scopedPlan: ScopedExtractionPlan | null;
  onReset: () => void;
  onUpdateRow: (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean | number) => void;
  onUpdateScopedRow: (pageNumber: number, rowIndex: number, field: keyof ScopedExtractionResult, value: string | boolean | number | string[] | ReviewStatus | null) => void;
  scopedDocumentReviewStatuses: Record<string, ScopedDocumentReviewStatus>;
  scopedSelectedMatches: Record<string, ScopedSelectedMatch>;
  onScopedDocumentReviewStatusChange: (parameterId: string, status: ScopedDocumentReviewStatus) => void;
  onScopedSelectedMatchChange: (parameterId: string, selectedMatch: ScopedSelectedMatch) => void;
  onRetryPage: (pageNumber: number) => void;
  onRetryFailed: () => void;
  hasRestoredResultsWithoutPreviews?: boolean;
  isRestoringPreviews?: boolean;
  restorePreviewsError?: string | null;
  onRestorePreviews?: (file: File) => void;
}

interface FlatRow extends ExtractedRow { rowIdx: number; lot_number: string | null; }
interface FlatScopedRow extends ScopedExtractionResult { rowIdx: number; page_number: number; lot_number: string | null; }
type ViewTab = "table" | "review" | "queue";

function EditableCell({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input aria-label="Editable cell" className="editable-cell" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onCommit(draft)} />;
}

const confidenceClass = (confidence: number) => confidence >= 0.8 ? "high" : confidence >= 0.6 ? "medium" : "low";
const hasSufficientConfidence = (confidence: number) => confidence >= 0.8;
const scopedReviewLabel = (row: FlatScopedRow) => {
  if (row.review_status === "not_applicable") return "Not applicable";
  if (row.needs_review) return "Needs review";
  return row.review_status === "accepted" ? "Accepted" : "OK";
};
const scopedReviewReasons = (row: FlatScopedRow) => row.review_reasons.filter((reason) => reason.trim().length > 0);
const canQuickAcceptScopedRow = (row: FlatScopedRow) => row.needs_review && hasSufficientConfidence(row.extraction_confidence) && scopedReviewReasons(row).length === 0;
const fullReviewLabel = (row: FlatRow) => row.needs_review ? "Needs review" : row.edited_by_user ? "Edited" : "OK";
const fullWarnings = (row: FlatRow) => row.warnings ?? [];
const canQuickAcceptFullRow = (row: FlatRow) => row.needs_review && hasSufficientConfidence(row.extraction_confidence) && fullWarnings(row).length === 0;

export default function ResultsView({ pages, scopedPages, extractionMode, allPages, pagePreviews, filename, failedCount, scopedPlan, onReset, onUpdateRow, onUpdateScopedRow, scopedDocumentReviewStatuses, scopedSelectedMatches, onScopedDocumentReviewStatusChange, onScopedSelectedMatchChange, onRetryPage, onRetryFailed, hasRestoredResultsWithoutPreviews = false, isRestoringPreviews = false, restorePreviewsError = null, onRestorePreviews }: ResultsViewProps) {
  const rowsPerPage = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const allRows: FlatRow[] = useMemo(() => pages.flatMap((page) => page.rows.map((row, rowIdx) => ({ ...row, rowIdx, lot_number: page.lot_number }))), [pages]);
  const scopedRows: FlatScopedRow[] = useMemo(() => scopedPages.flatMap((page) => page.scoped_results.map((row, rowIdx) => ({ ...row, rowIdx, page_number: page.page_number, lot_number: page.lot_number }))), [scopedPages]);
  const compiledScoped = useMemo(() => scopedPlan ? compileScopedResults(scopedPlan, allPages, { documentReviewStatuses: scopedDocumentReviewStatuses, selectedMatches: scopedSelectedMatches }) : null, [scopedPlan, allPages, scopedDocumentReviewStatuses, scopedSelectedMatches]);
  const totalRows = extractionMode === "scoped" ? scopedRows.length : allRows.length;
  const reviewCount = extractionMode === "scoped" ? (compiledScoped?.action_required_count ?? scopedRows.filter((row) => row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable").length) : allRows.filter((row) => row.needs_review).length;
  const editedCount = extractionMode === "scoped" ? scopedRows.filter((row) => row.edited_by_user).length : allRows.filter((row) => row.edited_by_user).length;
  const avgConfidence = totalRows > 0 ? (extractionMode === "scoped" ? scopedRows.reduce((sum, row) => sum + row.extraction_confidence, 0) : allRows.reduce((sum, row) => sum + row.extraction_confidence, 0)) / totalRows : 0;
  const successfulPages = extractionMode === "scoped" ? scopedPages.length : pages.length;
  const lotNumber = (extractionMode === "scoped" ? scopedPages.find((page) => page.lot_number)?.lot_number : pages.find((page) => page.lot_number)?.lot_number) ?? "Not detected";
  const totalPagesCount = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = allRows.slice(startIndex, startIndex + rowsPerPage);
  const paginatedScopedRows = scopedRows.slice(startIndex, startIndex + rowsPerPage);
  const failedPages = allPages.filter((page) => page.status === "failed");

  const [viewTab, setViewTab] = useState<ViewTab>(() => reviewCount > 0 ? "queue" : "table");
  const [hasChosenView, setHasChosenView] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ pageNumber: number; rowIndex: number | null }>({ pageNumber: 1, rowIndex: null });
  const [selectedScopedParameterId, setSelectedScopedParameterId] = useState<string | null>(null);
  const [documentDetailParameterId, setDocumentDetailParameterId] = useState<string | null>(null);
  const [resolvedReviewActionCount, setResolvedReviewActionCount] = useState(0);
  const queueReviewCount = reviewCount;

  useEffect(() => {
    if (queueReviewCount === 0 && viewTab === "queue") {
      setViewTab("table");
      return;
    }
    if (!hasChosenView) {
      setViewTab(queueReviewCount > 0 ? "queue" : "table");
    }
  }, [hasChosenView, queueReviewCount, viewTab]);

  const selectView = (tab: ViewTab) => {
    setHasChosenView(true);
    setViewTab(tab);
  };


  const openRestoreFilePicker = () => {
    if (restoreInputRef.current) restoreInputRef.current.value = "";
    restoreInputRef.current?.click();
  };

  const handleRestoreFileSelected = (file: File | undefined) => {
    if (!file || !onRestorePreviews) return;
    onRestorePreviews(file);
  };

  const handleDownload = () => {
    if (failedCount > 0 && !window.confirm(`${failedCount} page(s) failed. Export only successful pages?`)) return;
    if (extractionMode === "scoped" && !compiledScoped) return;
    const csv = extractionMode === "scoped" ? buildScopedCSV(compiledScoped!) : buildCSV(pages);
    const base = filename.replace(/\.pdf$/i, "") || "mbr-extraction";
    downloadCSV(csv, `${base}-${extractionMode === "scoped" ? "scoped" : "extracted"}.csv`);
  };

  const openReviewTarget = (pageNumber: number, rowIndex: number) => {
    setSelectedScopedParameterId(null);
    setDocumentDetailParameterId(null);
    setReviewTarget({ pageNumber, rowIndex });
    setHasChosenView(true);
    setViewTab("review");
  };

  const openScopedParameterDetail = (parameterId: string) => {
    setSelectedScopedParameterId(parameterId);
    setDocumentDetailParameterId(parameterId);
    setHasChosenView(true);
    setViewTab("queue");
  };

  const acceptReviewItem = (pageNumber: number, rowIndex: number) => {
    if (extractionMode === "scoped") {
      onUpdateScopedRow(pageNumber, rowIndex, "review_status", "accepted");
      onUpdateScopedRow(pageNumber, rowIndex, "needs_review", false);
    } else {
      onUpdateRow(pageNumber, rowIndex, "needs_review", false);
    }
    setResolvedReviewActionCount((count) => count + 1);
  };

  const markReviewItemNotApplicable = (pageNumber: number, rowIndex: number) => {
    if (extractionMode !== "scoped") return;
    onUpdateScopedRow(pageNumber, rowIndex, "review_status", "not_applicable");
    onUpdateScopedRow(pageNumber, rowIndex, "needs_review", false);
    setResolvedReviewActionCount((count) => count + 1);
  };

  const markDocumentParameterNotApplicable = (parameterId: string) => {
    if (scopedDocumentReviewStatuses[parameterId] !== "not_applicable") {
      onScopedDocumentReviewStatusChange(parameterId, "not_applicable");
      setResolvedReviewActionCount((count) => count + 1);
    }
    setDocumentDetailParameterId(null);
  };

  const selectScopedMatchForExport = (parameterId: string, selectedMatch: ScopedSelectedMatch) => {
    const previous = scopedSelectedMatches[parameterId];
    onScopedSelectedMatchChange(parameterId, selectedMatch);
    if (!previous || previous.page_number !== selectedMatch.page_number || previous.row_index !== selectedMatch.row_index) {
      setResolvedReviewActionCount((count) => count + 1);
    }
  };

  const leaveDocumentParameterUnresolved = () => {
    setDocumentDetailParameterId(null);
  };

  return (
    <div className="results-container fade-in">
      <div className="results-header">
        <div className="results-heading-block">
          <p className="eyebrow">{extractionMode === "scoped" ? "Scoped results" : "Full extraction"}</p>
          <h2 className="results-title">Extraction Results</h2>
          <div className="results-subtitle" title={filename}>{filename}</div>
        </div>
        <div className="results-actions primary-results-actions">
          <button className="btn btn-success" onClick={handleDownload} id="download-csv-btn">Download CSV</button>
          <button className="btn btn-secondary" onClick={onReset}>New PDF</button>
          {failedCount > 0 && <button className="btn btn-secondary" onClick={onRetryFailed}>Retry failed pages</button>}
        </div>
      </div>

      <div className="results-overview-card">
        {lotNumber !== "Not detected" && <div className="results-lot compact-lot"><div className="lot-label">Batch Lot Number</div><div className="lot-value">{lotNumber}</div></div>}
        <div className="metadata-grid results-metadata-grid" aria-label="Export summary">
          <div className="metadata-item"><span className="metadata-label">Pages</span><span className="metadata-value metric-value">{successfulPages}/{allPages.length}</span></div>
          <div className="metadata-item"><span className="metadata-label">Failed</span><span className="metadata-value metric-value">{failedCount}</span></div>
          <div className="metadata-item"><span className="metadata-label">{extractionMode === "scoped" ? "Scoped results" : "Rows"}</span><span className="metadata-value metric-value">{totalRows}</span></div>
          <div className="metadata-item"><span className="metadata-label">{extractionMode === "scoped" ? "Action required" : "Need review"}</span><span className="metadata-value metric-value">{reviewCount}</span></div>
          <div className="metadata-item"><span className="metadata-label">Edited</span><span className="metadata-value metric-value">{editedCount}</span></div>
          <div className="metadata-item"><span className="metadata-label">Avg confidence</span><span className="metadata-value metric-value">{(avgConfidence * 100).toFixed(0)}%</span></div>
        </div>
      </div>



      <input
        ref={restoreInputRef}
        className="restore-previews-input"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose the same PDF to restore page previews"
        onChange={(event) => handleRestoreFileSelected(event.target.files?.[0])}
      />

      {hasRestoredResultsWithoutPreviews && (
        <div className="callout callout-info restore-previews-callout">
          <div>
            <strong>Extracted results were restored.</strong> Page images are kept private in browser memory and are not saved with sessions, so choose the same PDF to restore side-by-side previews without re-running extraction.
            {restorePreviewsError ? <div className="restore-previews-error">{restorePreviewsError}</div> : null}
          </div>
          <button className="btn btn-secondary" onClick={openRestoreFilePicker} disabled={isRestoringPreviews}>
            {isRestoringPreviews ? "Restoring previews…" : "Restore previews"}
          </button>
        </div>
      )}

      {failedCount > 0 && (
        <div className="callout callout-warning retry-callout">
          <div><strong>{failedCount} page{failedCount > 1 ? "s" : ""} failed.</strong> Failed pages are omitted from CSV export unless retried.</div>
          <div className="retry-button-list">
            {failedPages.map((page) => <button key={page.pageNumber} className="btn btn-secondary" onClick={() => onRetryPage(page.pageNumber)}>Retry page {page.pageNumber}</button>)}
          </div>
        </div>
      )}

      <div className="view-tabs" role="tablist" aria-label="Results views">
        <button className={`tab-button ${viewTab === "queue" ? "active" : ""}`} role="tab" aria-selected={viewTab === "queue"} onClick={() => selectView("queue")}>Action required ({queueReviewCount})</button>
        <button className={`tab-button ${viewTab === "table" ? "active" : ""}`} role="tab" aria-selected={viewTab === "table"} onClick={() => selectView("table")}>Results table</button>
        <button className={`tab-button ${viewTab === "review" ? "active" : ""}`} role="tab" aria-selected={viewTab === "review"} onClick={() => selectView("review")}>Side-by-side review</button>
      </div>

      {viewTab === "queue" && <ReviewQueue mode={extractionMode} pages={pages} scopedPages={scopedPages} compiledScoped={compiledScoped} selectedDocumentParameterId={documentDetailParameterId} resolvedReviewCount={resolvedReviewActionCount} onSelect={openReviewTarget} onSelectParameter={openScopedParameterDetail} onAccept={acceptReviewItem} onMarkNotApplicable={markReviewItemNotApplicable} onMarkDocumentNotApplicable={markDocumentParameterNotApplicable} onLeaveDocumentUnresolved={leaveDocumentParameterUnresolved} onSelectScopedMatch={selectScopedMatchForExport} />}
      {viewTab === "review" && <ReviewWorkspace mode={extractionMode} pages={pages} scopedPages={scopedPages} previews={pagePreviews} initialPage={reviewTarget.pageNumber} initialRow={reviewTarget.rowIndex} onUpdateFullRow={onUpdateRow} onUpdateScopedRow={onUpdateScopedRow} onRetryPage={onRetryPage} onRestorePreviews={onRestorePreviews} isRestoringPreviews={isRestoringPreviews} />}
      {viewTab === "table" && (extractionMode === "scoped" ? (
        <>
          <ScopedExtractionSummary pages={scopedPages} compiled={compiledScoped} focusedParameterId={selectedScopedParameterId} />
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Page</th><th>Parameter</th><th>Target</th><th>Actual</th><th>Units</th><th>Source</th><th>Conf.</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {paginatedScopedRows.map((row) => {
                  const reviewReasons = scopedReviewReasons(row);
                  const statusClass = row.needs_review ? "badge-warning" : "badge-success";
                  return (
                    <tr key={`${row.page_number}-${row.parameter_id}-${row.rowIdx}`}>
                      <td>{row.page_number}</td>
                      <td>{row.display_name}</td>
                      <td><EditableCell value={row.target_value ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "target_value", v)} /></td>
                      <td><EditableCell value={row.actual_value ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "actual_value", v)} /></td>
                      <td><EditableCell value={row.units ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "units", v)} /></td>
                      <td><EditableCell value={row.source_label ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "source_label", v)} /></td>
                      <td><span className="confidence-bar"><span className={`confidence-fill ${confidenceClass(row.extraction_confidence)}`} style={{ width: `${row.extraction_confidence * 100}%` }} /></span>{(row.extraction_confidence * 100).toFixed(0)}%</td>
                      <td><span className={`badge ${statusClass}`} title={reviewReasons.join(", ")}>{scopedReviewLabel(row)}</span></td>
                      <td>
                        <div className="table-action-group">
                          <button className="btn btn-secondary btn-compact" onClick={() => openReviewTarget(row.page_number, row.rowIdx)}>{row.needs_review ? "Review" : "Open"}</button>
                          <button className="btn btn-secondary btn-compact" onClick={() => openReviewTarget(row.page_number, row.rowIdx)}>Open in side-by-side</button>
                          {canQuickAcceptScopedRow(row) && <button className="btn btn-success btn-compact" onClick={() => acceptReviewItem(row.page_number, row.rowIdx)}>Quick accept</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Page</th><th>Parameter</th><th>Target</th><th>Actual</th><th>Units</th><th>Performed</th><th>Verified</th><th>Conf.</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, i) => {
                const warnings = fullWarnings(row);
                const statusClass = row.needs_review ? "badge-warning" : "badge-success";
                return (
                  <tr key={`${row.page_number}-${row.row_id}-${startIndex + i}`}>
                    <td>{row.page_number}</td>
                    <td><EditableCell value={row.parameter_label ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "parameter_label", v)} /></td>
                    <td><EditableCell value={row.target_value ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "target_value", v)} /></td>
                    <td><EditableCell value={row.actual_value ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "actual_value", v)} /></td>
                    <td><EditableCell value={row.units ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "units", v)} /></td>
                    <td>{row.performed_by_initials ?? "—"}</td>
                    <td>{row.verified_by_initials ?? "—"}</td>
                    <td><span className="confidence-bar"><span className={`confidence-fill ${confidenceClass(row.extraction_confidence)}`} style={{ width: `${row.extraction_confidence * 100}%` }} /></span>{(row.extraction_confidence * 100).toFixed(0)}%</td>
                    <td><span className={`badge ${statusClass}`} title={warnings.map((w) => w.code).join(", ")}>{fullReviewLabel(row)}</span></td>
                    <td>
                      <div className="table-action-group">
                        <button className="btn btn-secondary btn-compact" onClick={() => openReviewTarget(row.page_number, row.rowIdx)}>{row.needs_review ? "Review" : "Open"}</button>
                        <button className="btn btn-secondary btn-compact" onClick={() => openReviewTarget(row.page_number, row.rowIdx)}>Open in side-by-side</button>
                        {canQuickAcceptFullRow(row) && <button className="btn btn-success btn-compact" onClick={() => acceptReviewItem(row.page_number, row.rowIdx)}>Quick accept</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {viewTab === "table" && totalRows > rowsPerPage && <div className="pagination-controls"><button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button><span>Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} rows.</span><button className="btn btn-secondary" disabled={currentPage === totalPagesCount} onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}>Next</button></div>}
    </div>
  );
}
