import { useMemo, useState, useEffect } from "react";
import type { PageExtraction, ExtractedRow } from "../types";
import { buildCSV, downloadCSV } from "../lib/csv-builder";

interface ResultsViewProps {
  pages: PageExtraction[];
  filename: string;
  failedCount: number;
  onReset: () => void;
  onUpdateRow: (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean) => void;
}

/** A controlled-looking input that commits changes to parent only on blur,
 *  preventing focus loss caused by parent re-renders on every keystroke. */
function EditableCell({
  initialValue,
  onCommit,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  // Sync when the parent data changes from an external source (e.g. session restore)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      type="text"
      className="inline-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      placeholder="—"
    />
  );
}

export default function ResultsView({
  pages,
  filename,
  failedCount,
  onReset,
  onUpdateRow,
}: ResultsViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;
  const allRows = useMemo(
    () =>
      pages.flatMap((p) =>
        p.rows.map((r, rowIdx) => ({ ...r, lot_number: p.lot_number, rowIdx }))
      ),
    [pages]
  );

  const totalRows = allRows.length;
  const reviewCount = allRows.filter((r) => r.needs_review).length;
  const avgConfidence =
    totalRows > 0
      ? allRows.reduce((s, r) => s + r.extraction_confidence, 0) / totalRows
      : 0;
  const lotNumber =
    pages.find((p) => p.lot_number)?.lot_number ?? "Not detected";

  const handleDownload = () => {
    const csv = buildCSV(pages);
    const baseName = filename.replace(/\.pdf$/i, "");
    downloadCSV(csv, `${baseName}_extracted.csv`);
  };

  const confidenceClass = (val: number) => {
    if (val >= 0.8) return "confidence-high";
    if (val >= 0.5) return "confidence-medium";
    return "confidence-low";
  };

  const totalPagesCount = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRows = allRows.slice(startIndex, startIndex + rowsPerPage);

  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPagesCount));
  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));

  const handleCellEdit = (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string) => {
    onUpdateRow(pageNumber, rowIndex, field, value);
    // Unflag review need if actual value or parameter label is modified manually
    if (field === "actual_value" || field === "parameter_label") {
      onUpdateRow(pageNumber, rowIndex, "needs_review", false);
    }
  };

  return (
    <div className="results-container fade-in">
      <div className="results-header">
        <h2 className="results-title">✅ Extraction Complete</h2>
        <div className="results-actions">
          <button className="btn btn-secondary" onClick={onReset} id="new-extraction-btn">
            📄 New Extraction
          </button>
          <button className="btn btn-success" onClick={handleDownload} id="download-csv-btn">
            ⬇️ Download CSV
          </button>
        </div>
      </div>

      {lotNumber !== "Not detected" && (
        <div className="results-lot">
          <div className="lot-label">Batch Lot Number</div>
          <div className="lot-value">{lotNumber}</div>
        </div>
      )}

      <div className="results-summary">
        <div className="stat-card">
          <div className="stat-value">{pages.length}</div>
          <div className="stat-label">Pages</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalRows}</div>
          <div className="stat-label">Total Rows</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{reviewCount}</div>
          <div className="stat-label">Need Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(avgConfidence * 100).toFixed(0)}%</div>
          <div className="stat-label">Avg Confidence</div>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="error-banner" style={{ marginBottom: "24px" }}>
          ⚠️ {failedCount} page{failedCount > 1 ? "s" : ""} failed during
          extraction and are not included in the results.
        </div>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Parameter</th>
              <th>Target</th>
              <th>Actual</th>
              <th>Units</th>
              <th>Performed</th>
              <th>Verified</th>
              <th>Conf.</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, i) => (
              <tr key={startIndex + i}>
                <td>{row.page_number}</td>
                <td style={{ color: "var(--text-primary)", maxWidth: "200px" }}>
                  <EditableCell
                    initialValue={row.parameter_label ?? ""}
                    onCommit={(v) => handleCellEdit(row.page_number, row.rowIdx, "parameter_label", v)}
                  />
                </td>
                <td>
                  <EditableCell
                    initialValue={row.target_value ?? ""}
                    onCommit={(v) => handleCellEdit(row.page_number, row.rowIdx, "target_value", v)}
                  />
                </td>
                <td style={{ color: "var(--accent-primary)" }}>
                  <EditableCell
                    initialValue={row.actual_value ?? ""}
                    onCommit={(v) => handleCellEdit(row.page_number, row.rowIdx, "actual_value", v)}
                  />
                </td>
                <td>
                  <EditableCell
                    initialValue={row.units ?? ""}
                    onCommit={(v) => handleCellEdit(row.page_number, row.rowIdx, "units", v)}
                  />
                </td>
                <td>{row.performed_by_initials ?? "—"}</td>
                <td>{row.verified_by_initials ?? "—"}</td>
                <td>
                  <span className="confidence-bar">
                    <span
                      className={`confidence-fill ${confidenceClass(row.extraction_confidence)}`}
                      style={{
                        width: `${row.extraction_confidence * 100}%`,
                      }}
                    />
                  </span>
                  {(row.extraction_confidence * 100).toFixed(0)}%
                </td>
                <td>
                  {row.needs_review ? (
                    <span 
                      className="badge badge-warning" 
                      style={{cursor: 'pointer'}} 
                      onClick={() => onUpdateRow(row.page_number, row.rowIdx, "needs_review", false)}
                      title="Click to clear review flag"
                    >
                      Review
                    </span>
                  ) : (
                    <span className="badge badge-success">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > rowsPerPage && (
        <div className="pagination-controls" style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px",
            color: "var(--text-muted)",
            fontSize: "13px",
        }}>
          <button 
            className="btn btn-secondary" 
            disabled={currentPage === 1} 
            onClick={handlePrevPage}
            style={{ padding: '4px 12px', fontSize: '13px' }}
          >
            Previous
          </button>
          <span>
            Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} rows. Download the CSV for the full dataset.
          </span>
          <button 
            className="btn btn-secondary" 
            disabled={currentPage === totalPagesCount} 
            onClick={handleNextPage}
            style={{ padding: '4px 12px', fontSize: '13px' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
