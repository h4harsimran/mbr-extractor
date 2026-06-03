import { describe, expect, it } from "vitest";
import { buildCSV, escapeCSV } from "../csv-builder";

describe("CSV escaping", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCSV('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it("protects against formula injection prefixes", () => {
    expect(escapeCSV("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCSV("+cmd")).toBe("'+cmd");
    expect(escapeCSV("-cmd")).toBe("'-cmd");
    expect(escapeCSV("@cmd")).toBe("'@cmd");
    expect(escapeCSV("\tcmd")).toBe("'\tcmd");
    expect(escapeCSV("\rcmd")).toBe('"\'\rcmd"');
  });

  it("includes review and edited columns", () => {
    const csv = buildCSV([{ page_number: 1, lot_number: "LOT", rows: [{ page_number: 1, row_id: "1", parameter_label: "p", target_value: null, actual_value: "=1+1", units: null, comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.5, needs_review: true, review_reason: "low", edited_by_user: true }] }]);
    expect(csv).toContain("review_reason,edited_by_user");
    expect(csv).toContain("'=1+1");
  });
});
