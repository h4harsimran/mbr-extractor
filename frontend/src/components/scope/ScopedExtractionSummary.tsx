import { useEffect, useMemo, useState } from "react";
import type { ScopedPageExtraction, ScopedExtractionResult } from "../../types";
import type { CompiledScopedResult, CompiledScopedParameter } from "../../lib/compile-scoped-results";

function status(row: ScopedExtractionResult): string {
  if (row.review_status === "not_applicable") return "Not applicable";
  if (row.needs_review) return row.review_reasons.join(", ") || "Review open";
  return row.review_status === "accepted" ? "Accepted" : "OK";
}

function parameterStatus(parameter: CompiledScopedParameter): string {
  if (parameter.overall_status === "multiple_matches") return "Multiple matches";
  if (parameter.overall_status === "needs_review") return "Needs review";
  if (parameter.overall_status === "not_found") return "Not found";
  return "Matched";
}

function parameterDetails(parameter: CompiledScopedParameter): string {
  if (parameter.overall_status === "not_found") {
    const units = parameter.expected_units.length > 0 ? parameter.expected_units.join(", ") : "any expected unit";
    const synonyms = parameter.synonyms.length > 0 ? parameter.synonyms.join(", ") : "no additional synonyms";
    return `No match was found across processed pages. Expected units: ${units}. Search terms: ${synonyms}.`;
  }
  if (parameter.overall_status === "multiple_matches") return "Multiple candidate matches were found; inspect the side-by-side review panel for detailed evidence.";
  if (parameter.overall_status === "needs_review") return "One or more matches are flagged for review; use the Review queue for workflow actions.";
  return "Single match found with no open review status.";
}

function fieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function confidenceLabel(row: ScopedExtractionResult): string {
  return `${Math.round(row.extraction_confidence * 100)}%`;
}

function evidencePreview(text: string | null | undefined, maxLength = 120): string {
  if (!text) return "—";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

type MatchSummaryRow = ScopedExtractionResult & { page_number?: number };

function MatchSummaryCard({ row, label, pageNumber }: { row: MatchSummaryRow; label?: string; pageNumber?: number }) {
  const fullEvidence = row.nearby_text?.trim();
  const preview = evidencePreview(fullEvidence ?? row.source_label);
  const canExpand = Boolean(fullEvidence && fullEvidence !== preview);

  return (
    <article className="scoped-match-card">
      <div className="scoped-match-card-heading">
        {label && <strong>{label}</strong>}
        <span className={`badge ${row.needs_review || row.review_status === "not_applicable" ? "badge-warning" : "badge-success"}`}>{status(row)}</span>
      </div>
      <dl className="scoped-match-fields" aria-label={`${label ?? row.display_name} match summary`}>
        <div><dt>Page</dt><dd>{fieldValue(pageNumber ?? row.page_number)}</dd></div>
        <div><dt>Extracted value</dt><dd>{fieldValue(row.actual_value ?? row.target_value)}</dd></div>
        <div><dt>Units</dt><dd>{fieldValue(row.units)}</dd></div>
        <div><dt>Confidence</dt><dd>{confidenceLabel(row)}</dd></div>
        <div><dt>Status</dt><dd>{status(row)}</dd></div>
      </dl>
      <div className="scoped-evidence-preview">
        <span className="scoped-evidence-label">Evidence preview</span>
        <span>{preview}</span>
      </div>
      {canExpand && (
        <details className="scoped-evidence-details">
          <summary>Expand evidence</summary>
          <div>{fullEvidence}</div>
        </details>
      )}
    </article>
  );
}

export default function ScopedExtractionSummary({ pages, compiled, focusedParameterId }: { pages: ScopedPageExtraction[]; compiled: CompiledScopedResult | null; focusedParameterId?: string | null }) {
  const [view, setView] = useState<"page" | "parameter">("parameter");
  const rowsByPage = useMemo(() => pages.map((page) => ({ page, rows: page.scoped_results })), [pages]);

  useEffect(() => {
    if (focusedParameterId) setView("parameter");
  }, [focusedParameterId]);

  return (
    <div>
      <div className="results-actions scoped-summary-actions" aria-label="Scoped result overview views">
        <button className={`btn btn-secondary ${view === "parameter" ? "active" : ""}`} onClick={() => setView("parameter")}>By parameter</button>
        <button className={`btn btn-secondary ${view === "page" ? "active" : ""}`} onClick={() => setView("page")}>By page</button>
      </div>
      {view === "parameter" ? (
        <div className="scope-groups" aria-label="Scoped results by parameter">
          {(compiled?.parameters ?? []).map((parameter) => {
            const isFocused = parameter.parameter_id === focusedParameterId;
            return (
              <section className={`scope-review-card ${isFocused ? "selected" : ""}`} key={parameter.parameter_id} aria-live={isFocused ? "polite" : undefined}>
                <h3>{parameter.display_name} <span className={`badge ${parameter.overall_status === "not_found" || parameter.overall_status === "needs_review" ? "badge-warning" : "badge-success"}`}>{parameterStatus(parameter)}</span></h3>
                <p className="scope-review-meta">{parameterDetails(parameter)}</p>
                {parameter.matches.length === 0 ? <div className="empty-state">No match found anywhere in the processed pages.</div> : (
                  <div className="scoped-match-list">
                    {parameter.matches.map((row, index) => (
                      <MatchSummaryCard key={`${row.page_number}-${row.parameter_id}-${index}`} row={row} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {!compiled && <div className="empty-state">No scoped compilation is available.</div>}
        </div>
      ) : (
        <div className="scope-groups" aria-label="Scoped results by page">
          {rowsByPage.map(({ page, rows }) => (
            <section className="scope-review-card" key={page.page_number}>
              <h3>Page {page.page_number}</h3>
              {page.page_warnings?.length ? <p className="scope-review-meta">Warnings: {page.page_warnings.join(", ")}</p> : null}
              {rows.length === 0 ? <div className="empty-state">No scoped parameters found on this page.</div> : (
                <div className="scoped-match-list">
                  {rows.map((row, index) => (
                    <MatchSummaryCard key={`${page.page_number}-${row.parameter_id}-${index}`} row={row} label={row.display_name} pageNumber={page.page_number} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
