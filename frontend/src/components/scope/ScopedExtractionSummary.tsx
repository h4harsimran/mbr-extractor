import { useMemo, useState } from "react";
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

export default function ScopedExtractionSummary({ pages, compiled }: { pages: ScopedPageExtraction[]; compiled: CompiledScopedResult | null }) {
  const [view, setView] = useState<"page" | "parameter" | "review">("parameter");
  const rows = useMemo(() => pages.flatMap((page) => page.scoped_results.map((row) => ({ ...row, page_number: page.page_number, lot_number: page.lot_number }))), [pages]);
  const reviewRows = rows.filter((row) => row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable");
  const rowsByPage = useMemo(() => pages.map((page) => ({ page, rows: page.scoped_results })), [pages]);
  const reviewParameters = compiled?.parameters.filter((parameter) => parameter.overall_status === "needs_review" || parameter.overall_status === "not_found") ?? [];

  return (
    <div>
      <div className="results-actions scoped-summary-actions">
        <button className="btn btn-secondary" onClick={() => setView("page")}>By page</button>
        <button className="btn btn-secondary" onClick={() => setView("parameter")}>By parameter</button>
        <button className="btn btn-secondary" onClick={() => setView("review")}>Review only</button>
      </div>
      {view === "parameter" ? (
        <div className="scope-groups">
          {(compiled?.parameters ?? []).map((parameter) => (
            <section className="scope-review-card" key={parameter.parameter_id}>
              <h3>{parameter.display_name} <span className={`badge ${parameter.overall_status === "not_found" || parameter.overall_status === "needs_review" ? "badge-warning" : "badge-success"}`}>{parameterStatus(parameter)}</span></h3>
              {parameter.matches.length === 0 ? <p>No match found anywhere in the processed pages.</p> : parameter.matches.map((row, index) => (
                <p key={`${row.page_number}-${row.parameter_id}-${index}`}>Page {row.page_number}: {row.actual_value ?? row.target_value ?? "Matched"} {row.units ?? ""} — {row.nearby_text ?? row.source_label ?? status(row)}</p>
              ))}
            </section>
          ))}
          {!compiled && <div className="empty-state">No scoped compilation is available.</div>}
        </div>
      ) : view === "review" ? (
        <div className="scope-groups">
          {reviewParameters.map((parameter) => (
            <section className="scope-review-card" key={parameter.parameter_id}>
              <h3>{parameter.display_name} <span className="badge badge-warning">{parameterStatus(parameter)}</span></h3>
              {parameter.matches.length === 0 ? <p>No match found anywhere in the processed pages.</p> : parameter.matches.map((row, index) => <p key={`${row.page_number}-${index}`}>Page {row.page_number}: {row.nearby_text ?? row.review_reasons.join(", ")}</p>)}
            </section>
          ))}
          {reviewRows.length === 0 && reviewParameters.length === 0 && <div className="empty-state">No scoped parameters currently need review.</div>}
        </div>
      ) : (
        <div className="scope-groups">
          {rowsByPage.map(({ page, rows }) => (
            <section className="scope-review-card" key={page.page_number}>
              <h3>Page {page.page_number}</h3>
              {page.page_warnings?.length ? <p className="scope-review-meta">Warnings: {page.page_warnings.join(", ")}</p> : null}
              {rows.length === 0 ? <div className="empty-state">No scoped parameters found on this page.</div> : (
                <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>Parameter</th><th>Actual</th><th>Units</th><th>Evidence</th><th>Review</th></tr></thead>
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
