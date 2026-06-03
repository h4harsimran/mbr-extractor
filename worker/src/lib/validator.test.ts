import { describe, expect, it } from "vitest";
import { validatePageResponse } from "./validator";

const row = { page_number: 1, row_id: "r1", parameter_label: "Temp", actual_value: "37", performed_by_initials: "AA", verified_by_initials: "BB", extraction_confidence: 0.9 };

describe("full extraction validator", () => {
  it("preserves page mismatch warning", () => {
    const result = validatePageResponse(JSON.stringify({ page_number: 2, rows: [row] }), 1);
    expect(result.page_extraction?.page_number).toBe(1);
    expect(result.page_extraction?.warnings?.[0].code).toBe("PAGE_NUMBER_MISMATCH");
  });

  it("preserves row mismatch warning", () => {
    const result = validatePageResponse(JSON.stringify({ page_number: 1, rows: [{ ...row, page_number: 2 }] }), 1);
    expect(result.page_extraction?.rows[0].warnings?.map((warning) => warning.code)).toContain("PAGE_NUMBER_MISMATCH");
  });

  it("preserves missing rows repair warning", () => {
    const result = validatePageResponse(JSON.stringify({ page_number: 1 }), 1);
    expect(result.page_extraction?.warnings?.map((warning) => warning.code)).toContain("MODEL_SCHEMA_REPAIR");
  });

  it("preserves excess rows truncation warning", () => {
    const result = validatePageResponse(JSON.stringify({ page_number: 1, rows: Array.from({ length: 121 }, () => row) }), 1);
    expect(result.page_extraction?.rows).toHaveLength(120);
    expect(result.page_extraction?.warnings?.map((warning) => warning.code)).toContain("EXCESS_ROWS");
  });
});
