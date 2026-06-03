import type { PageExtraction, ExtractedRow, ScopedPageExtraction, ScopedExtractionResult } from "../types";

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
  "matched",
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

export function buildScopedCSV(pages: ScopedPageExtraction[]): string {
  const lines = [SCOPED_CSV_COLUMNS.join(",")];
  for (const page of pages) {
    for (const row of page.scoped_results) {
      const values = SCOPED_CSV_COLUMNS.map((col) => {
        if (col === "page_number") return escapeCSV(page.page_number);
        if (col === "lot_number") return escapeCSV(page.lot_number);
        if (col === "parameter_name") return escapeCSV(row.display_name);
        return escapeCSV(row[col as keyof ScopedExtractionResult]);
      });
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
