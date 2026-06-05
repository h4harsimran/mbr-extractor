import { describe, expect, it } from "vitest";
import { buildCSV, buildScopedCSV, escapeCSV } from "../csv-builder";
import type { CompiledScopedResult } from "../compile-scoped-results";

const compiled: CompiledScopedResult = {
  total_matches: 3,
  not_found_count: 1,
  row_review_count: 0,
  multiple_match_count: 1,
  action_required_count: 2,
  needs_review_count: 2,
  parameters: [
    {
      parameter_id: "temperature",
      display_name: "Temperature",
      expected_units: ["°C"],
      synonyms: [],
      overall_status: "multiple_matches",
      matches: [
        { parameter_id: "temperature", display_name: "Temperature", matched: true, target_value: null, actual_value: "37", units: "°C", source_label: "Temp", nearby_text: "first", comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.9, needs_review: false, review_status: "accepted", review_reasons: [], page_number: 1, row_index: 0, lot_number: "LOT" },
        { parameter_id: "temperature", display_name: "Temperature", matched: true, target_value: null, actual_value: "38", units: "°C", source_label: "Temp", nearby_text: "second", comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.91, needs_review: false, review_status: "accepted", review_reasons: [], page_number: 2, row_index: 0, lot_number: "LOT" },
      ],
    },
    { parameter_id: "ph", display_name: "pH", expected_units: [], synonyms: [], overall_status: "not_found", matches: [] },
    {
      parameter_id: "formula",
      display_name: "Formula",
      expected_units: [],
      synonyms: [],
      overall_status: "matched",
      matches: [{ parameter_id: "formula", display_name: "Formula", matched: true, target_value: null, actual_value: "=1+1", units: null, source_label: "+source", nearby_text: "@nearby", comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.8, needs_review: false, review_status: "accepted", review_reasons: [], page_number: 3, row_index: 0, lot_number: null }],
    },
  ],
};

describe("CSV escaping", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCSV('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it("protects against formula injection prefixes including leading whitespace", () => {
    expect(escapeCSV("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCSV("+cmd")).toBe("'+cmd");
    expect(escapeCSV("-10")).toBe("'-10");
    expect(escapeCSV("@cmd")).toBe("'@cmd");
    expect(escapeCSV("\tcmd")).toBe("'\tcmd");
    expect(escapeCSV(" =HYPERLINK(\"x\")")).toBe('"\' =HYPERLINK(""x"")"');
    expect(escapeCSV("\rcmd")).toBe('"\'\rcmd"');
  });

  it("includes review and edited columns", () => {
    const csv = buildCSV([{ page_number: 1, lot_number: "LOT", rows: [{ page_number: 1, row_id: "1", parameter_label: "p", target_value: null, actual_value: "=1+1", units: null, comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.5, needs_review: true, review_reason: "low", edited_by_user: true }] }]);
    expect(csv).toContain("review_reason,edited_by_user");
    expect(csv).toContain("'=1+1");
  });

  it("exports missing scoped parameters once only", () => {
    const csv = buildScopedCSV(compiled);
    expect(csv.split("\n").filter((line) => line.startsWith("ph,")).length).toBe(1);
    expect(csv).toContain("ph,pH,not_found");
    expect(csv).toContain("PARAMETER_NOT_FOUND_IN_DOCUMENT");
  });

  it("exports matched scoped parameters as match rows in scope order", () => {
    const rows = buildScopedCSV(compiled).split("\n");
    expect(rows[1]).toContain("temperature,Temperature,multiple_matches,1");
    expect(rows[2]).toContain("temperature,Temperature,multiple_matches,2");
    expect(rows[3]).toContain("ph,pH,not_found");
    expect(rows[4]).toContain("formula,Formula,matched,3");
  });

  it("exports document-level not applicable decisions without active review", () => {
    const csv = buildScopedCSV({ ...compiled, parameters: [{ parameter_id: "ph", display_name: "pH", expected_units: [], synonyms: [], overall_status: "not_applicable", matches: [] }], total_matches: 0, not_found_count: 0, row_review_count: 0, multiple_match_count: 0, action_required_count: 0, needs_review_count: 0 });
    expect(csv).toContain("ph,pH,not_applicable");
    expect(csv).toContain(",false,not_applicable,");
    expect(csv).not.toContain("PARAMETER_NOT_FOUND_IN_DOCUMENT");
  });

  it("exports only the selected multiple-match row when compiled as resolved", () => {
    const csv = buildScopedCSV({ ...compiled, parameters: [{ ...compiled.parameters[0], overall_status: "matched", matches: [compiled.parameters[0].matches[1]] }], total_matches: 1, not_found_count: 0, row_review_count: 0, multiple_match_count: 0, action_required_count: 0, needs_review_count: 0 });
    expect(csv).not.toContain("37");
    expect(csv).toContain("temperature,Temperature,matched,2");
  });

  it("preserves CSV formula protection for scoped exports", () => {
    const csv = buildScopedCSV(compiled);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+source");
    expect(csv).toContain("'@nearby");
  });
});
