import { useMemo } from "react";
import type { PageExtraction } from "../types";
import { buildCSV, downloadCSV } from "../lib/csv-builder";

interface ResultsViewProps {
  pages: PageExtraction[];
  filename: string;
  failedCount: number;
  onReset: () => void;
}

export default function ResultsView({
  pages,
  filename,
  failedCount,
  onReset,
}: ResultsViewProps) {
  const allRows = useMemo(
    () =>
      pages.flatMap((p) =>
        p.rows.map((r) => ({ ...r, lot_number: p.lot_number }))
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

  // Show up to 50 rows in the preview table
  const previewRows = allRows.slice(0, 50);

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
            {previewRows.map((row, i) => (
              <tr key={i}>
                <td>{row.page_number}</td>
                <td style={{ color: "var(--text-primary)", maxWidth: "200px" }}>
                  {row.parameter_label ?? "—"}
                </td>
                <td>{row.target_value ?? "—"}</td>
                <td style={{ color: "var(--accent-primary)" }}>
                  {row.actual_value ?? "—"}
                </td>
                <td>{row.units ?? "—"}</td>
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
                    <span className="badge badge-warning">Review</span>
                  ) : (
                    <span className="badge badge-success">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allRows.length > 50 && (
        <div
          style={{
            textAlign: "center",
            padding: "16px",
            color: "var(--text-muted)",
            fontSize: "13px",
          }}
        >
          Showing first 50 of {allRows.length} rows. Download the CSV for the
          full dataset.
        </div>
      )}
    </div>
  );
}
