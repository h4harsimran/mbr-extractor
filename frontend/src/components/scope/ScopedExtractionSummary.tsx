import { useMemo, useState } from "react";
import type { ScopedPageExtraction } from "../../types";

export default function ScopedExtractionSummary({ pages }: { pages: ScopedPageExtraction[] }) {
  const [view, setView] = useState<"page" | "parameter" | "review">("parameter");
  const rows = useMemo(() => pages.flatMap((page) => page.scoped_results.map((row) => ({ ...row, page_number: page.page_number, lot_number: page.lot_number }))), [pages]);
  const visibleRows = view === "review" ? rows.filter((row) => row.needs_review) : rows;
  const parameterGroups = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    for (const row of visibleRows) groups.set(row.parameter_id, [...(groups.get(row.parameter_id) ?? []), row]);
    return Array.from(groups.entries());
  }, [visibleRows]);

  return (
    <div>
      <div className="results-actions" style={{ marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={() => setView("page")}>By page</button>
        <button className="btn btn-secondary" onClick={() => setView("parameter")}>By parameter</button>
        <button className="btn btn-secondary" onClick={() => setView("review")}>Review only</button>
      </div>
      {view === "parameter" || view === "review" ? (
        <div className="scope-groups">
          {parameterGroups.map(([parameterId, group]) => (
            <section className="scope-review-card" key={parameterId}>
              <h3>{group[0]?.display_name ?? parameterId}</h3>
              {group.map((row) => (
                <p key={`${row.page_number}-${row.parameter_id}`}>Page {row.page_number}: {row.matched ? `${row.actual_value ?? row.target_value ?? "Matched"} ${row.units ?? ""}` : "Not found"} — {row.nearby_text ?? row.review_reasons.join(", ")}</p>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table"><thead><tr><th>Page</th><th>Parameter</th><th>Matched</th><th>Actual</th><th>Units</th><th>Evidence</th><th>Review</th></tr></thead>
            <tbody>{visibleRows.map((row) => <tr key={`${row.page_number}-${row.parameter_id}`}><td>{row.page_number}</td><td>{row.display_name}</td><td>{row.matched ? "Yes" : "No"}</td><td>{row.actual_value ?? "—"}</td><td>{row.units ?? "—"}</td><td>{row.nearby_text ?? row.source_label ?? "—"}</td><td>{row.needs_review ? row.review_reasons.join(", ") : "OK"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
