import type { ExtractionMode, PageExtraction, ScopedPageExtraction } from "../../types";
import type { CompiledScopedResult } from "../../lib/compile-scoped-results";

interface Props {
  mode: ExtractionMode;
  pages: PageExtraction[];
  scopedPages: ScopedPageExtraction[];
  compiledScoped: CompiledScopedResult | null;
  onSelect: (pageNumber: number, rowIndex: number) => void;
  onSelectParameter: (parameterId: string) => void;
}

type QueueItem = {
  key: string;
  pageNumber: number | null;
  rowIndex: number | null;
  label: string;
  reason: string;
  parameterId?: string;
};

export default function ReviewQueue({ mode, pages, scopedPages, compiledScoped, onSelect, onSelectParameter }: Props) {
  const items: QueueItem[] = mode === "scoped"
    ? [
        ...scopedPages.flatMap((page) => page.scoped_results.map((row, rowIndex) => ({ key: `page-${page.page_number}-${rowIndex}`, pageNumber: page.page_number, rowIndex, label: row.display_name, reason: row.review_reasons.join("; ") || "Needs review", include: row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable" }))).filter((item) => item.include),
        ...(compiledScoped?.parameters.filter((parameter) => parameter.overall_status === "not_found").map((parameter) => ({ key: `document-${parameter.parameter_id}`, pageNumber: null, rowIndex: null, label: parameter.display_name, reason: "No match found anywhere in the processed pages. Open the parameter detail for expected units and search terms.", parameterId: parameter.parameter_id })) ?? []),
      ]
    : pages.flatMap((page) => page.rows.map((row, rowIndex) => ({ key: `page-${page.page_number}-${rowIndex}`, pageNumber: page.page_number, rowIndex, label: row.parameter_label ?? "Unnamed parameter", reason: row.warnings?.map((w) => w.message || w.code).join("; ") || row.review_reason || "Needs review", include: row.needs_review }))).filter((item) => item.include);

  const pageItems = items.filter((item) => item.pageNumber !== null);
  const documentItems = items.filter((item) => item.pageNumber === null);
  const grouped = pageItems.reduce<Record<number, QueueItem[]>>((acc, item) => ({ ...acc, [item.pageNumber!]: [...(acc[item.pageNumber!] ?? []), item] }), {});
  return (
    <section className="section-card review-queue-panel" aria-label="Review queue">
      <div className="section-header compact">
        <span className="step-badge subtle">RQ</span>
        <div>
          <h3 className="section-title">Review queue ({items.length})</h3>
          <p className="section-description">Rows and document-level scoped parameters that need attention before downstream use.</p>
        </div>
      </div>
      {items.length === 0 ? <div className="empty-state">No rows currently need review.</div> : (
        <>
          {documentItems.length > 0 && <div className="scope-review-card review-queue-group"><strong>Document-level not found</strong>{documentItems.map((item) => (
            <button key={item.key} className="review-row-card" onClick={() => item.parameterId && onSelectParameter(item.parameterId)} aria-label={`Open document-level detail for ${item.label}`}>
              <strong>{item.label}</strong><span>{item.reason}</span>
            </button>
          ))}</div>}
          {Object.entries(grouped).map(([page, group]) => (
            <div key={page} className="scope-review-card review-queue-group">
              <strong>Page {page}</strong>
              {group.map((item) => (
                <button key={item.key} className="review-row-card" onClick={() => onSelect(item.pageNumber!, item.rowIndex!)}>
                  <strong>Page {item.pageNumber}: {item.label}</strong><span>{item.reason}</span>
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  );
}
