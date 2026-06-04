import { useEffect, useMemo, useState } from "react";
import ScopedExtractionSummary from "./scope/ScopedExtractionSummary";
import ReviewQueue from "./review/ReviewQueue";
import ReviewWorkspace from "./review/ReviewWorkspace";
import { buildCSV, buildScopedCSV, downloadCSV } from "../lib/csv-builder";
import { compileScopedResults } from "../lib/compile-scoped-results";
import type { ExtractedRow, ExtractionMode, PageExtraction, PagePreview, PageProgress, ReviewStatus, ScopedExtractionPlan, ScopedExtractionResult, ScopedPageExtraction } from "../types";

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
  onRetryPage: (pageNumber: number) => void;
  onRetryFailed: () => void;
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
const scopedReviewLabel = (row: FlatScopedRow) => {
  if (row.review_status === "not_applicable") return "Not applicable";
  if (row.needs_review) return "Review";
  return row.review_status === "accepted" ? "Accepted" : "OK";
};

export default function ResultsView({ pages, scopedPages, extractionMode, allPages, pagePreviews, filename, failedCount, scopedPlan, onReset, onUpdateRow, onUpdateScopedRow, onRetryPage, onRetryFailed }: ResultsViewProps) {
  const rowsPerPage = 50;
  const [currentPage, setCurrentPage] = useState(1);

  const allRows: FlatRow[] = useMemo(() => pages.flatMap((page) => page.rows.map((row, rowIdx) => ({ ...row, rowIdx, lot_number: page.lot_number }))), [pages]);
  const scopedRows: FlatScopedRow[] = useMemo(() => scopedPages.flatMap((page) => page.scoped_results.map((row, rowIdx) => ({ ...row, rowIdx, page_number: page.page_number, lot_number: page.lot_number }))), [scopedPages]);
  const compiledScoped = useMemo(() => scopedPlan ? compileScopedResults(scopedPlan, allPages) : null, [scopedPlan, allPages]);
  const totalRows = extractionMode === "scoped" ? scopedRows.length : allRows.length;
  const reviewCount = extractionMode === "scoped" ? (compiledScoped?.needs_review_count ?? scopedRows.filter((row) => row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable").length) : allRows.filter((row) => row.needs_review).length;
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
  const [documentNotApplicableIds, setDocumentNotApplicableIds] = useState<string[]>([]);
  const [resolvedReviewActionCount, setResolvedReviewActionCount] = useState(0);
  const multipleMatchReviewCount = extractionMode === "scoped" ? (compiledScoped?.parameters.filter((parameter) => parameter.overall_status === "multiple_matches").length ?? 0) : 0;
  const queueReviewCount = Math.max(0, reviewCount - documentNotApplicableIds.length) + multipleMatchReviewCount;

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
    if (!documentNotApplicableIds.includes(parameterId)) {
      setDocumentNotApplicableIds((ids) => [...ids, parameterId]);
      setResolvedReviewActionCount((count) => count + 1);
    }
    setDocumentDetailParameterId(null);
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
          <div className="metadata-item"><span className="metadata-label">Need review</span><span className="metadata-value metric-value">{reviewCount}</span></div>
          <div className="metadata-item"><span className="metadata-label">Edited</span><span className="metadata-value metric-value">{editedCount}</span></div>
          <div className="metadata-item"><span className="metadata-label">Avg confidence</span><span className="metadata-value metric-value">{(avgConfidence * 100).toFixed(0)}%</span></div>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="callout callout-warning retry-callout">
          <div><strong>{failedCount} page{failedCount > 1 ? "s" : ""} failed.</strong> Failed pages are omitted from CSV export unless retried.</div>
          <div className="retry-button-list">
            {failedPages.map((page) => <button key={page.pageNumber} className="btn btn-secondary" onClick={() => onRetryPage(page.pageNumber)}>Retry page {page.pageNumber}</button>)}
          </div>
        </div>
      )}

      <div className="view-tabs" role="tablist" aria-label="Results views">
        <button className={`tab-button ${viewTab === "queue" ? "active" : ""}`} role="tab" aria-selected={viewTab === "queue"} onClick={() => selectView("queue")}>Review queue ({queueReviewCount})</button>
        <button className={`tab-button ${viewTab === "table" ? "active" : ""}`} role="tab" aria-selected={viewTab === "table"} onClick={() => selectView("table")}>Results table</button>
        <button className={`tab-button ${viewTab === "review" ? "active" : ""}`} role="tab" aria-selected={viewTab === "review"} onClick={() => selectView("review")}>Side-by-side review</button>
      </div>

      {viewTab === "queue" && <ReviewQueue mode={extractionMode} pages={pages} scopedPages={scopedPages} compiledScoped={compiledScoped} documentNotApplicableIds={documentNotApplicableIds} selectedDocumentParameterId={documentDetailParameterId} resolvedReviewCount={resolvedReviewActionCount} onSelect={openReviewTarget} onSelectParameter={openScopedParameterDetail} onAccept={acceptReviewItem} onMarkNotApplicable={markReviewItemNotApplicable} onMarkDocumentNotApplicable={markDocumentParameterNotApplicable} onLeaveDocumentUnresolved={leaveDocumentParameterUnresolved} />}
      {viewTab === "review" && <ReviewWorkspace mode={extractionMode} pages={pages} scopedPages={scopedPages} previews={pagePreviews} initialPage={reviewTarget.pageNumber} initialRow={reviewTarget.rowIndex} onUpdateFullRow={onUpdateRow} onUpdateScopedRow={onUpdateScopedRow} onRetryPage={onRetryPage} />}
      {viewTab === "table" && (extractionMode === "scoped" ? (
        <>
          <ScopedExtractionSummary pages={scopedPages} compiled={compiledScoped} focusedParameterId={selectedScopedParameterId} />
          <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>Page</th><th>Parameter</th><th>Target</th><th>Actual</th><th>Units</th><th>Source</th><th>Conf.</th><th>Review</th></tr></thead><tbody>{paginatedScopedRows.map((row) => <tr key={`${row.page_number}-${row.parameter_id}-${row.rowIdx}`}><td>{row.page_number}</td><td>{row.display_name}</td><td><EditableCell value={row.target_value ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "target_value", v)} /></td><td><EditableCell value={row.actual_value ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "actual_value", v)} /></td><td><EditableCell value={row.units ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "units", v)} /></td><td><EditableCell value={row.source_label ?? ""} onCommit={(v) => onUpdateScopedRow(row.page_number, row.rowIdx, "source_label", v)} /></td><td><span className="confidence-bar"><span className={`confidence-fill ${confidenceClass(row.extraction_confidence)}`} style={{ width: `${row.extraction_confidence * 100}%` }} /></span>{(row.extraction_confidence * 100).toFixed(0)}%</td><td>{row.needs_review ? <button className="badge badge-warning" onClick={() => onUpdateScopedRow(row.page_number, row.rowIdx, "needs_review", false)} title={row.review_reasons.join(", ")}>{scopedReviewLabel(row)}</button> : <button className="badge badge-success" onClick={() => onUpdateScopedRow(row.page_number, row.rowIdx, "needs_review", true)}>{scopedReviewLabel(row)}</button>}</td></tr>)}</tbody></table></div>
        </>
      ) : (
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>Page</th><th>Parameter</th><th>Target</th><th>Actual</th><th>Units</th><th>Performed</th><th>Verified</th><th>Conf.</th><th>Review</th></tr></thead><tbody>{paginatedRows.map((row, i) => <tr key={`${row.page_number}-${row.row_id}-${startIndex + i}`}><td>{row.page_number}</td><td><EditableCell value={row.parameter_label ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "parameter_label", v)} /></td><td><EditableCell value={row.target_value ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "target_value", v)} /></td><td><EditableCell value={row.actual_value ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "actual_value", v)} /></td><td><EditableCell value={row.units ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "units", v)} /></td><td>{row.performed_by_initials ?? "—"}</td><td>{row.verified_by_initials ?? "—"}</td><td><span className="confidence-bar"><span className={`confidence-fill ${confidenceClass(row.extraction_confidence)}`} style={{ width: `${row.extraction_confidence * 100}%` }} /></span>{(row.extraction_confidence * 100).toFixed(0)}%</td><td>{row.needs_review ? <button className="badge badge-warning" onClick={() => onUpdateRow(row.page_number, row.rowIdx, "needs_review", false)} title={row.warnings?.map((w) => w.code).join(", ")}>Review</button> : row.edited_by_user ? <span className="badge badge-success">Edited</span> : <span className="badge badge-success">OK</span>}</td></tr>)}</tbody></table></div>
      ))}
      {viewTab === "table" && totalRows > rowsPerPage && <div className="pagination-controls"><button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button><span>Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} rows.</span><button className="btn btn-secondary" disabled={currentPage === totalPagesCount} onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}>Next</button></div>}
    </div>
  );
}
