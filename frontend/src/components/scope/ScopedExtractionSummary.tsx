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
  if (parameter.overall_status === "multiple_matches") return "Multiple candidate matches were found; use the table or side-by-side review to inspect the extracted rows.";
  if (parameter.overall_status === "needs_review") return "One or more matches are flagged for review; use the Review queue for workflow actions.";
  return "Single match found with no open review status.";
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
                {parameter.matches.length === 0 ? <p>No match found anywhere in the processed pages.</p> : parameter.matches.map((row, index) => (
                  <p key={`${row.page_number}-${row.parameter_id}-${index}`}>Page {row.page_number}: {row.actual_value ?? row.target_value ?? "Matched"} {row.units ?? ""} — {row.nearby_text ?? row.source_label ?? status(row)}</p>
                ))}
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
                <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>Parameter</th><th>Actual</th><th>Units</th><th>Evidence</th><th>Status</th></tr></thead>
                  <tbody>{rows.map((row, index) => <tr key={`${page.page_number}-${row.parameter_id}-${index}`}><td>{row.display_name}</td><td>{row.actual_value ?? "—"}</td><td>{row.units ?? "—"}</td><td>{row.nearby_text ?? row.source_label ?? "—"}</td><td>{status(row)}</td></tr>)}</tbody>
                </table></div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
