import type { ExtractionMode, PageExtraction, ScopedPageExtraction } from "../../types";

interface Props {
  mode: ExtractionMode;
  pages: PageExtraction[];
  scopedPages: ScopedPageExtraction[];
  onSelect: (pageNumber: number, rowIndex: number) => void;
}

export default function ReviewQueue({ mode, pages, scopedPages, onSelect }: Props) {
  const items = mode === "scoped"
    ? scopedPages.flatMap((page) => page.scoped_results.map((row, rowIndex) => ({ pageNumber: page.page_number, rowIndex, label: row.display_name, reason: row.matched ? row.review_reasons.join("; ") || "Needs review" : "Not found — review open", include: row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable" }))).filter((item) => item.include)
    : pages.flatMap((page) => page.rows.map((row, rowIndex) => ({ pageNumber: page.page_number, rowIndex, label: row.parameter_label ?? "Unnamed parameter", reason: row.warnings?.map((w) => w.message || w.code).join("; ") || row.review_reason || "Needs review", include: row.needs_review }))).filter((item) => item.include);
  const grouped = items.reduce<Record<number, typeof items>>((acc, item) => ({ ...acc, [item.pageNumber]: [...(acc[item.pageNumber] ?? []), item] }), {});
  return (
    <section className="section-card review-queue-panel" aria-label="Review queue">
      <div className="section-header compact">
        <span className="step-badge subtle">RQ</span>
        <div>
          <h3 className="section-title">Review queue ({items.length})</h3>
          <p className="section-description">Rows that need attention before downstream use.</p>
        </div>
      </div>
      {items.length === 0 ? <div className="empty-state">No rows currently need review.</div> : Object.entries(grouped).map(([page, group]) => (
        <div key={page} className="scope-review-card review-queue-group">
          <strong>Page {page}</strong>
          {group.map((item) => (
            <button key={`${item.pageNumber}-${item.rowIndex}`} className="review-row-card" onClick={() => onSelect(item.pageNumber, item.rowIndex)}>
              <strong>Page {item.pageNumber}: {item.label}</strong><span>{item.reason}</span>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
