import type { PageProgress } from "../types";

interface ExtractionProgressProps {
  pages: PageProgress[];
  filename: string;
  startTime: number;
}

export default function ExtractionProgress({
  pages,
  filename,
  startTime,
}: ExtractionProgressProps) {
  const completed = pages.filter((p) => p.status === "completed").length;
  const failed = pages.filter((p) => p.status === "failed").length;
  const totalRows = pages.reduce(
    (sum, p) => sum + (p.extraction?.rows.length ?? 0),
    0
  );
  const total = pages.length;
  const done = completed + failed;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  // Estimate time remaining
  const elapsed = (Date.now() - startTime) / 1000;
  const avgPerPage = done > 0 ? elapsed / done : 0;
  const remaining = done > 0 ? Math.round(avgPerPage * (total - done)) : 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="progress-container fade-in">
      <div className="progress-header">
        <h2 className="progress-title">Extracting Data…</h2>
        <div className="progress-file">{filename}</div>
      </div>

      <div className="progress-stats">
        <div className="stat-card">
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Pages Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalRows}</div>
          <div className="stat-label">Rows Found</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {done < total ? `~${formatTime(remaining)}` : "Done!"}
          </div>
          <div className="stat-label">Time Left</div>
        </div>
      </div>

      <div className="progress-bar-wrapper">
        <div className="progress-bar-header">
          <span className="progress-percent">{percent}%</span>
          <span className="progress-count">
            {done} of {total} pages
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="page-grid">
        {pages.map((p) => (
          <div
            key={p.pageNumber}
            className={`page-dot ${p.status}`}
            title={
              p.status === "failed"
                ? `Page ${p.pageNumber}: ${p.error}`
                : `Page ${p.pageNumber}: ${p.status}`
            }
          >
            {p.pageNumber}
          </div>
        ))}
      </div>

      {failed > 0 && (
        <div className="error-banner" style={{ marginTop: "24px" }}>
          ⚠️ {failed} page{failed > 1 ? "s" : ""} failed extraction. The
          data from successful pages will still be included in the CSV.
        </div>
      )}
    </div>
  );
}
