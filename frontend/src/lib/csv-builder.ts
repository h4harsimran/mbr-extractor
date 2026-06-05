import type { PageExtraction, ExtractedRow, ScopedPageExtraction } from "../types";
import type { CompiledScopedResult, ScopedParameterMatchWithPage } from "./compile-scoped-results";

export const CSV_COLUMNS = [
  "page_number",
  "lot_number",
  "row_id",
  "parameter_label",
  "target_value",
  "actual_value",
  "units",
  "comments",
  "performed_by_initials",
  "performed_date",
  "verified_by_initials",
  "verified_date",
  "extraction_confidence",
  "needs_review",
  "review_reason",
  "edited_by_user",
] as const;

export const SCOPED_CSV_COLUMNS = [
  "parameter_id",
  "parameter_name",
  "overall_status",
  "page_number",
  "lot_number",
  "target_value",
  "actual_value",
  "units",
  "source_label",
  "nearby_text",
  "comments",
  "performed_by_initials",
  "performed_date",
  "verified_by_initials",
  "verified_date",
  "extraction_confidence",
  "needs_review",
  "review_status",
  "review_reasons",
  "edited_by_user",
] as const;

const FORMULA_RE = /^\s*[=+\-@\t\r]/;

export function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = Array.isArray(value) ? value.join("; ") : String(value);
  if (FORMULA_RE.test(str)) str = `'${str}`;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCSV(pages: PageExtraction[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const page of pages) {
    for (const row of page.rows) {
      const values = CSV_COLUMNS.map((col) => {
        if (col === "lot_number") return escapeCSV(page.lot_number);
        return escapeCSV(row[col as keyof ExtractedRow]);
      });
      lines.push(values.join(","));
    }
  }
  return lines.join("\n");
}

function scopedValue(col: (typeof SCOPED_CSV_COLUMNS)[number], row: ScopedParameterMatchWithPage, overallStatus: string): unknown {
  if (col === "parameter_name") return row.display_name;
  if (col === "overall_status") return overallStatus;
  return row[col as keyof ScopedParameterMatchWithPage];
}

function legacyScopedPagesToCompiled(pages: ScopedPageExtraction[]): CompiledScopedResult {
  const parameters = pages.flatMap((page) => page.scoped_results.map((match) => ({
    parameter_id: match.parameter_id,
    display_name: match.display_name,
    expected_units: [],
    synonyms: [],
    matches: [{ ...match, page_number: page.page_number, row_index: 0, lot_number: page.lot_number }],
    overall_status: match.needs_review ? "needs_review" as const : "matched" as const,
  })));
  const rowReviewCount = parameters.filter((parameter) => parameter.overall_status === "needs_review").length;
  return { parameters, total_matches: parameters.length, not_found_count: 0, row_review_count: rowReviewCount, multiple_match_count: 0, action_required_count: rowReviewCount, needs_review_count: rowReviewCount };
}

export function buildScopedCSV(input: CompiledScopedResult | ScopedPageExtraction[]): string {
  const compiled = Array.isArray(input) ? legacyScopedPagesToCompiled(input) : input;
  const lines = [SCOPED_CSV_COLUMNS.join(",")];
  for (const parameter of compiled.parameters) {
    if (parameter.matches.length === 0) {
      const values = SCOPED_CSV_COLUMNS.map((col) => {
        if (col === "parameter_id") return escapeCSV(parameter.parameter_id);
        if (col === "parameter_name") return escapeCSV(parameter.display_name);
        if (col === "overall_status") return escapeCSV(parameter.overall_status);
        if (col === "needs_review") return escapeCSV(parameter.overall_status === "not_found");
        if (col === "review_status") return escapeCSV(parameter.overall_status === "not_applicable" ? "not_applicable" : "open");
        if (col === "review_reasons") return escapeCSV(parameter.overall_status === "not_found" ? ["PARAMETER_NOT_FOUND_IN_DOCUMENT"] : []);
        return escapeCSV(null);
      });
      lines.push(values.join(","));
      continue;
    }

    for (const match of parameter.matches) {
      const values = SCOPED_CSV_COLUMNS.map((col) => escapeCSV(scopedValue(col, match, parameter.overall_status)));
      lines.push(values.join(","));
    }
  }
  return lines.join("\n");
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
