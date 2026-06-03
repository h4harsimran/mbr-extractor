import { useMemo, useState } from "react";
import { buildCSV, downloadCSV } from "../lib/csv-builder";
import type { ExtractedRow, PageExtraction, PageProgress } from "../types";

interface ResultsViewProps {
  pages: PageExtraction[];
  allPages: PageProgress[];
  filename: string;
  failedCount: number;
  onReset: () => void;
  onUpdateRow: (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean | number) => void;
  onRetryPage: (pageNumber: number) => void;
  onRetryFailed: () => void;
}

interface FlatRow extends ExtractedRow {
  rowIdx: number;
  lot_number: string | null;
}

function EditableCell({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      aria-label="Editable cell"
      className="editable-cell"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
    />
  );
}

const confidenceClass = (confidence: number) => {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
};

export default function ResultsView({ pages, allPages, filename, failedCount, onReset, onUpdateRow, onRetryPage, onRetryFailed }: ResultsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const allRows: FlatRow[] = useMemo(
    () => pages.flatMap((page) => page.rows.map((row, rowIdx) => ({ ...row, rowIdx, lot_number: page.lot_number }))),
    [pages]
  );

  const totalRows = allRows.length;
  const reviewCount = allRows.filter((row) => row.needs_review).length;
  const editedCount = allRows.filter((row) => row.edited_by_user).length;
  const avgConfidence = totalRows > 0 ? allRows.reduce((sum, row) => sum + row.extraction_confidence, 0) / totalRows : 0;
  const successfulPages = pages.length;
  const lotNumber = pages.find((page) => page.lot_number)?.lot_number ?? "Not detected";
  const totalPagesCount = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = allRows.slice(startIndex, startIndex + rowsPerPage);
  const failedPages = allPages.filter((page) => page.status === "failed");

  const handleDownload = () => {
    if (failedCount > 0 && !window.confirm(`${failedCount} page(s) failed. Export only successful pages?`)) return;
    const csv = buildCSV(pages);
    const base = filename.replace(/\.pdf$/i, "") || "mbr-extraction";
    downloadCSV(csv, `${base}-extracted.csv`);
  };

  return (
    <div className="results-container fade-in">
      <div className="results-header">
        <div>
          <h2 className="results-title">Extraction Results</h2>
          <div className="results-subtitle">{filename}</div>
        </div>
        <div className="results-actions">
          <button className="btn btn-secondary" onClick={onReset}>New PDF</button>
          {failedCount > 0 && <button className="btn btn-secondary" onClick={onRetryFailed}>Retry all failed</button>}
          <button className="btn btn-success" onClick={handleDownload} id="download-csv-btn">Download CSV</button>
        </div>
      </div>

      {lotNumber !== "Not detected" && (
        <div className="results-lot"><div className="lot-label">Batch Lot Number</div><div className="lot-value">{lotNumber}</div></div>
      )}

      <div className="results-summary" aria-label="Export summary">
        <div className="stat-card"><div className="stat-value">{allPages.length}</div><div className="stat-label">Total pages</div></div>
        <div className="stat-card"><div className="stat-value">{successfulPages}</div><div className="stat-label">Successful pages</div></div>
        <div className="stat-card"><div className="stat-value">{failedCount}</div><div className="stat-label">Failed pages</div></div>
        <div className="stat-card"><div className="stat-value">{totalRows}</div><div className="stat-label">Rows</div></div>
        <div className="stat-card"><div className="stat-value">{reviewCount}</div><div className="stat-label">Need review</div></div>
        <div className="stat-card"><div className="stat-value">{editedCount}</div><div className="stat-label">Edited</div></div>
        <div className="stat-card"><div className="stat-value">{(avgConfidence * 100).toFixed(0)}%</div><div className="stat-label">Avg confidence</div></div>
      </div>

      {failedCount > 0 && (
        <div className="error-banner" style={{ marginBottom: 24 }}>
          ⚠️ {failedCount} page{failedCount > 1 ? "s" : ""} failed and will be omitted unless retried.
          <div style={{ marginTop: 12 }}>
            {failedPages.map((page) => (
              <button key={page.pageNumber} className="btn btn-secondary" style={{ marginRight: 8, marginBottom: 8 }} onClick={() => onRetryPage(page.pageNumber)}>
                Retry page {page.pageNumber}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Page</th><th>Parameter</th><th>Target</th><th>Actual</th><th>Units</th><th>Performed</th><th>Verified</th><th>Conf.</th><th>Review</th></tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, i) => (
              <tr key={`${row.page_number}-${row.row_id}-${startIndex + i}`}>
                <td>{row.page_number}</td>
                <td><EditableCell value={row.parameter_label ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "parameter_label", v)} /></td>
                <td><EditableCell value={row.target_value ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "target_value", v)} /></td>
                <td><EditableCell value={row.actual_value ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "actual_value", v)} /></td>
                <td><EditableCell value={row.units ?? ""} onCommit={(v) => onUpdateRow(row.page_number, row.rowIdx, "units", v)} /></td>
                <td>{row.performed_by_initials ?? "—"}</td>
                <td>{row.verified_by_initials ?? "—"}</td>
                <td><span className="confidence-bar"><span className={`confidence-fill ${confidenceClass(row.extraction_confidence)}`} style={{ width: `${row.extraction_confidence * 100}%` }} /></span>{(row.extraction_confidence * 100).toFixed(0)}%</td>
                <td>
                  {row.needs_review ? (
                    <button className="badge badge-warning" onClick={() => onUpdateRow(row.page_number, row.rowIdx, "needs_review", false)} title={row.warnings?.map((w) => w.code).join(", ")}>Review</button>
                  ) : row.edited_by_user ? <span className="badge badge-success">Edited</span> : <span className="badge badge-success">OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > rowsPerPage && (
        <div className="pagination-controls" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
          <button className="btn btn-secondary" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
          <span>Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} rows.</span>
          <button className="btn btn-secondary" disabled={currentPage === totalPagesCount} onClick={() => setCurrentPage((p) => Math.min(totalPagesCount, p + 1))}>Next</button>
        </div>
      )}
    </div>
  );
}
