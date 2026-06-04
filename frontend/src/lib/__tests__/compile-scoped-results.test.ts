import { describe, expect, it } from "vitest";
import { compileScopedResults } from "../compile-scoped-results";
import type { PageProgress, ScopedExtractionPlan, ScopedExtractionResult } from "../../types";

const scope: ScopedExtractionPlan = {
  scope_version: 1,
  document_type: "master_batch_record",
  extraction_mode: "scoped",
  parameters: [
    { parameter_id: "temperature", display_name: "Temperature", description: "", expected_units: ["°C"], synonyms: ["temp"], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] },
    { parameter_id: "ph", display_name: "pH", description: "", expected_units: [], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] },
    { parameter_id: "pressure", display_name: "Pressure", description: "", expected_units: ["psi"], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] },
  ],
};

const match = (parameter_id: string, overrides: Partial<ScopedExtractionResult> = {}): ScopedExtractionResult => ({
  parameter_id,
  display_name: parameter_id,
  matched: true,
  target_value: null,
  actual_value: "1",
  units: null,
  source_label: "Label",
  nearby_text: "Evidence",
  comments: null,
  performed_by_initials: null,
  performed_date: null,
  verified_by_initials: null,
  verified_date: null,
  extraction_confidence: 0.9,
  needs_review: false,
  review_reasons: [],
  review_status: "accepted",
  ...overrides,
});

const pages = (matches: ScopedExtractionResult[]): PageProgress[] => [{ pageNumber: 1, status: "completed", extraction: null, scopedExtraction: { page_number: 1, lot_number: "LOT", scoped_results: matches }, error: null }];

describe("compileScopedResults", () => {
  it("preserves scope order", () => {
    const compiled = compileScopedResults(scope, pages([match("ph"), match("temperature")]));
    expect(compiled.parameters.map((parameter) => parameter.parameter_id)).toEqual(["temperature", "ph", "pressure"]);
  });

  it("includes a missing parameter once in the compiled result", () => {
    const compiled = compileScopedResults(scope, pages([match("temperature")]));
    expect(compiled.parameters.filter((parameter) => parameter.overall_status === "not_found").map((parameter) => parameter.parameter_id)).toEqual(["ph", "pressure"]);
    expect(compiled.not_found_count).toBe(2);
  });

  it("groups multiple page matches under the same parameter", () => {
    const compiled = compileScopedResults(scope, [
      ...pages([match("temperature", { actual_value: "37" })]),
      { pageNumber: 2, status: "completed", extraction: null, scopedExtraction: { page_number: 2, lot_number: null, scoped_results: [match("temperature", { actual_value: "38" })] }, error: null },
    ]);
    expect(compiled.parameters[0].matches.map((item) => item.page_number)).toEqual([1, 2]);
    expect(compiled.parameters[0].overall_status).toBe("multiple_matches");
  });

  it("sets needs_review status when any match needs review", () => {
    const compiled = compileScopedResults(scope, pages([match("temperature", { needs_review: true, review_status: "open", review_reasons: ["LOW_CONFIDENCE"] })]));
    expect(compiled.parameters[0].overall_status).toBe("needs_review");
  });

  it("preserves duplicate matches on the same page", () => {
    const compiled = compileScopedResults(scope, pages([match("temperature", { nearby_text: "first" }), match("temperature", { nearby_text: "second" })]));
    expect(compiled.parameters[0].matches.map((item) => item.nearby_text)).toEqual(["first", "second"]);
  });
});
