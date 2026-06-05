import type { ExtractionMode, PageExtraction, ScopedPageExtraction } from "../../types";
import type { CompiledScopedParameter, CompiledScopedResult } from "../../lib/compile-scoped-results";

interface Props {
  mode: ExtractionMode;
  pages: PageExtraction[];
  scopedPages: ScopedPageExtraction[];
  compiledScoped: CompiledScopedResult | null;
  selectedDocumentParameterId: string | null;
  resolvedReviewCount: number;
  onSelect: (pageNumber: number, rowIndex: number) => void;
  onSelectParameter: (parameterId: string) => void;
  onAccept: (pageNumber: number, rowIndex: number) => void;
  onMarkNotApplicable: (pageNumber: number, rowIndex: number) => void;
  onMarkDocumentNotApplicable: (parameterId: string) => void;
  onLeaveDocumentUnresolved: () => void;
  onSelectScopedMatch: (parameterId: string, selectedMatch: { page_number: number; row_index: number }) => void;
}

type QueueGroup = "missing" | "low_confidence" | "unit_mismatch" | "multiple_matches" | "other";

type QueueItem = {
  key: string;
  pageNumber: number | null;
  rowIndex: number | null;
  label: string;
  reason: string;
  currentValue: string;
  confidence: number | null;
  parameterId?: string;
  groups: QueueGroup[];
  kind: "row" | "document" | "multiple";
  expectedUnits?: string[];
  synonyms?: string[];
  matchCount?: number;
  matches?: CompiledScopedParameter["matches"];
};

const GROUP_LABELS: Record<QueueGroup, string> = {
  missing: "Missing fields",
  low_confidence: "Low confidence",
  unit_mismatch: "Unit mismatch",
  multiple_matches: "Multiple matches",
  other: "Other review items",
};

const GROUP_ORDER: QueueGroup[] = ["missing", "low_confidence", "unit_mismatch", "multiple_matches", "other"];

const confidenceLabel = (confidence: number | null) => confidence === null ? "—" : `${Math.round(confidence * 100)}%`;
const present = (value: string | null | undefined) => value && value.trim().length > 0 ? value : null;

const compactValue = (parts: Array<[string, string | null | undefined]>) => {
  const values = parts.map(([label, value]) => present(value) ? `${label}: ${value}` : null).filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "No extracted value";
};

const rowGroups = (reason: string, confidence: number, values: Array<string | null | undefined>, forceMultiple = false): QueueGroup[] => {
  const normalized = reason.toLowerCase();
  const groups: QueueGroup[] = [];
  if (values.some((value) => !present(value)) || normalized.includes("missing") || normalized.includes("not found")) groups.push("missing");
  if (confidence < 0.6 || normalized.includes("low confidence")) groups.push("low_confidence");
  if (normalized.includes("unit") || normalized.includes("units")) groups.push("unit_mismatch");
  if (forceMultiple || normalized.includes("multiple match") || normalized.includes("duplicate")) groups.push("multiple_matches");
  return groups.length > 0 ? groups : ["other"];
};

const documentReason = (parameter: CompiledScopedParameter) => `No match found across processed pages. Expected units: ${parameter.expected_units.length > 0 ? parameter.expected_units.join(", ") : "not specified"}. Search terms: ${parameter.synonyms.length > 0 ? parameter.synonyms.join(", ") : "not specified"}.`;

export default function ReviewQueue({
  mode,
  pages,
  scopedPages,
  compiledScoped,
  selectedDocumentParameterId,
  resolvedReviewCount,
  onSelect,
  onSelectParameter,
  onAccept,
  onMarkNotApplicable,
  onMarkDocumentNotApplicable,
  onLeaveDocumentUnresolved,
  onSelectScopedMatch,
}: Props) {
  const items: QueueItem[] = mode === "scoped"
    ? [
        ...scopedPages.flatMap((page) => page.scoped_results.map((row, rowIndex) => {
          const reason = row.review_reasons.join("; ") || "Needs review";
          return {
            key: `page-${page.page_number}-${rowIndex}`,
            pageNumber: page.page_number,
            rowIndex,
            label: row.display_name,
            reason,
            currentValue: compactValue([["Actual", row.actual_value], ["Target", row.target_value], ["Units", row.units], ["Source", row.source_label]]),
            confidence: row.extraction_confidence,
            parameterId: row.parameter_id,
            groups: rowGroups(reason, row.extraction_confidence, [row.actual_value, row.target_value], false),
            kind: "row" as const,
            include: row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable",
          };
        })).filter((item) => item.include),
        ...(compiledScoped?.parameters.filter((parameter) => parameter.overall_status === "not_found").map((parameter) => ({
          key: `document-${parameter.parameter_id}`,
          pageNumber: null,
          rowIndex: null,
          label: parameter.display_name,
          reason: documentReason(parameter),
          currentValue: "No extracted value",
          confidence: null,
          parameterId: parameter.parameter_id,
          groups: ["missing" as const],
          kind: "document" as const,
          expectedUnits: parameter.expected_units,
          synonyms: parameter.synonyms,
        })) ?? []),
        ...(compiledScoped?.parameters.filter((parameter) => parameter.overall_status === "multiple_matches").map((parameter) => ({
          key: `multiple-${parameter.parameter_id}`,
          pageNumber: parameter.matches[0]?.page_number ?? null,
          rowIndex: parameter.matches[0]?.row_index ?? null,
          label: parameter.display_name,
          reason: `${parameter.matches.length} matches found. Choose the correct occurrence before export.`,
          currentValue: parameter.matches.map((match) => `Page ${match.page_number}: ${present(match.actual_value) ?? present(match.target_value) ?? "No value"}`).join(" · "),
          confidence: parameter.matches.length > 0 ? Math.max(...parameter.matches.map((match) => match.extraction_confidence)) : null,
          parameterId: parameter.parameter_id,
          groups: ["multiple_matches" as const],
          kind: "multiple" as const,
          matchCount: parameter.matches.length,
          matches: parameter.matches,
        })) ?? []),
      ]
    : pages.flatMap((page) => page.rows.map((row, rowIndex) => {
      const reason = row.warnings?.map((w) => w.message || w.code).join("; ") || row.review_reason || "Needs review";
      return {
        key: `page-${page.page_number}-${rowIndex}`,
        pageNumber: page.page_number,
        rowIndex,
        label: row.parameter_label ?? "Unnamed parameter",
        reason,
        currentValue: compactValue([["Actual", row.actual_value], ["Target", row.target_value], ["Units", row.units]]),
        confidence: row.extraction_confidence,
        groups: rowGroups(reason, row.extraction_confidence, [row.actual_value, row.performed_by_initials, row.verified_by_initials]),
        kind: "row" as const,
        include: row.needs_review,
      };
    })).filter((item) => item.include);

  const selectedDocumentItem = items.find((item) => item.kind === "document" && item.parameterId === selectedDocumentParameterId);
  const totalReviewItems = items.length + resolvedReviewCount;
  const resolvedReviewItems = resolvedReviewCount;
  const itemsByGroup = GROUP_ORDER.map((group) => ({ group, items: items.filter((item) => item.groups.includes(group)) })).filter(({ items: groupItems }) => groupItems.length > 0);

  return (
    <section className="section-card review-queue-panel" aria-label="Review queue">
      <div className="section-header compact">
        <span className="step-badge subtle">RQ</span>
        <div>
          <h3 className="section-title">Action required ({items.length})</h3>
          <p className="section-description">Rows, missing document-level scoped parameters, and multiple-match choices that need attention before downstream use.</p>
        </div>
      </div>
      <div className="review-completion-indicator" aria-live="polite">
        {resolvedReviewItems} of {totalReviewItems} review item{totalReviewItems === 1 ? "" : "s"} resolved.
      </div>
      {items.length === 0 ? <div className="empty-state">No scoped actions or rows currently need review.</div> : (
        <div className="review-queue-layout">
          <div className="review-queue-groups">
            {itemsByGroup.map(({ group, items: groupItems }) => (
              <div key={group} className="scope-review-card review-queue-group">
                <div className="review-queue-group-heading"><strong>{GROUP_LABELS[group]}</strong><span>{groupItems.length}</span></div>
                {groupItems.map((item) => (
                  <article key={`${group}-${item.key}`} className="review-row-card review-item-card">
                    <div className="review-card-header">
                      <strong>{item.pageNumber ? `Page ${item.pageNumber}: ${item.label}` : item.label}</strong>
                      <span className="badge">{confidenceLabel(item.confidence)}</span>
                    </div>
                    <div className="review-card-value">{item.currentValue}</div>
                    <div className="review-card-reason">{item.reason}</div>
                    <div className="review-card-actions">
                      {item.kind === "row" && item.pageNumber !== null && item.rowIndex !== null && <button className="btn btn-secondary" onClick={() => onSelect(item.pageNumber!, item.rowIndex!)}>Review in document</button>}
                      {item.kind === "row" && item.pageNumber !== null && item.rowIndex !== null && <button className="btn btn-success" onClick={() => onAccept(item.pageNumber!, item.rowIndex!)}>Accept</button>}
                      {mode === "scoped" && item.kind === "row" && item.pageNumber !== null && item.rowIndex !== null && <button className="btn btn-secondary" onClick={() => onMarkNotApplicable(item.pageNumber!, item.rowIndex!)}>Mark not applicable</button>}
                      {item.kind === "document" && item.parameterId && <button className="btn btn-secondary" onClick={() => onSelectParameter(item.parameterId!)}>Open detail panel</button>}
                      {item.kind === "document" && item.parameterId && <button className="btn btn-secondary" onClick={() => onMarkDocumentNotApplicable(item.parameterId!)}>Mark not applicable</button>}
                      {item.kind === "multiple" && item.pageNumber !== null && item.rowIndex !== null && <button className="btn btn-secondary" onClick={() => onSelect(item.pageNumber!, item.rowIndex!)}>Review in document</button>}
                      {item.kind === "multiple" && item.parameterId && item.matches && (
                        <div className="multiple-match-options" aria-label={`Candidate matches for ${item.label}`}>
                          {item.matches.map((match) => (
                            <div key={`${match.page_number}-${match.row_index}`} className="multiple-match-option">
                              <div><strong>Page {match.page_number}</strong> · Actual: {present(match.actual_value) ?? "—"} · Target: {present(match.target_value) ?? "—"} · Units: {present(match.units) ?? "—"} · Source: {present(match.source_label) ?? "—"} · Confidence: {confidenceLabel(match.extraction_confidence)}</div>
                              <div className="review-card-reason">{present(match.nearby_text) ?? "No nearby text"}</div>
                              <button className="btn btn-success" onClick={() => item.parameterId && onSelectScopedMatch(item.parameterId, { page_number: match.page_number, row_index: match.row_index })}>Use this match</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
          {selectedDocumentItem && (
            <aside className="scope-review-card document-not-found-panel" aria-label="Document-level not-found detail">
              <p className="eyebrow">Document-level not found</p>
              <h4>{selectedDocumentItem.label}</h4>
              <p>No match was found for this parameter across the processed pages. Review the extraction scope terms below, then decide whether this parameter is not applicable to this record or should remain unresolved.</p>
              <dl className="document-not-found-details">
                <div><dt>Extracted value</dt><dd>{selectedDocumentItem.currentValue}</dd></div>
                <div><dt>Confidence</dt><dd>{confidenceLabel(selectedDocumentItem.confidence)}</dd></div>
                <div><dt>Expected units</dt><dd>{selectedDocumentItem.expectedUnits?.join(", ") || "Not specified"}</dd></div>
                <div><dt>Search terms</dt><dd>{selectedDocumentItem.synonyms?.join(", ") || "Not specified"}</dd></div>
                <div><dt>Reason</dt><dd>{selectedDocumentItem.reason}</dd></div>
              </dl>
              <div className="review-card-actions">
                <button className="btn btn-secondary" onClick={() => selectedDocumentItem.parameterId && onMarkDocumentNotApplicable(selectedDocumentItem.parameterId)}>Mark N/A</button>
                <button className="btn btn-secondary" onClick={onLeaveDocumentUnresolved}>Leave unresolved</button>
              </div>
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
