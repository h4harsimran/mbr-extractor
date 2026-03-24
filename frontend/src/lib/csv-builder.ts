// ── CSV builder — ported from Python exporter.py ───────────────────

import type { PageExtraction, ExtractedRow } from "../types";

const CSV_COLUMNS = [
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
] as const;

/**
 * Escape a CSV field value (handle commas, quotes, newlines).
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from page extractions.
 */
export function buildCSV(pages: PageExtraction[]): string {
  const lines: string[] = [];

  // Header
  lines.push(CSV_COLUMNS.join(","));

  // Data rows
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

/**
 * Trigger a CSV file download in the browser.
 */
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
