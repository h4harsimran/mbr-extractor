import { describe, expect, it } from "vitest";
import { validateScopedPageResponse } from "./scoped-extraction-validator";
import type { ScopedExtractionPlan } from "./scope-schema";

const plan: ScopedExtractionPlan = {
  scope_version: 1,
  document_type: "master_batch_record",
  extraction_mode: "scoped",
  parameters: [
    { parameter_id: "temperature", display_name: "Temperature", description: "", expected_units: ["°C"], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number", "source_label", "nearby_text"], needs_review_rules: [] },
    { parameter_id: "ph", display_name: "pH", description: "", expected_units: [], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] },
  ],
};

const match = (overrides = {}) => ({ parameter_id: "temperature", display_name: "Wrong", actual_value: "37", source_label: "Temp", nearby_text: "Temp actual 37", extraction_confidence: 0.95, needs_review: false, review_reasons: [], ...overrides });

describe("scoped extraction validator", () => {
  it("accepts an empty page with empty matches", () => {
    const result = validateScopedPageResponse(JSON.stringify({ page_number: 1, lot_number: null, matches: [] }), 1, plan);
    expect(result.valid).toBe(true);
    expect(result.scoped_page_extraction?.scoped_results).toEqual([]);
    expect(result.scoped_page_extraction?.matches).toEqual([]);
  });

  it("returns one scoped parameter match only when one parameter is present", () => {
    const raw = JSON.stringify({ page_number: 1, lot_number: "LOT", matches: [match()] });
    const result = validateScopedPageResponse(raw, 1, plan);
    expect(result.valid).toBe(true);
    expect(result.scoped_page_extraction?.scoped_results).toHaveLength(1);
    expect(result.scoped_page_extraction?.scoped_results[0]).toMatchObject({ parameter_id: "temperature", display_name: "Temperature", actual_value: "37", matched: true });
  });

  it("does not synthesize missing rows for absent parameters", () => {
    const raw = JSON.stringify({ page_number: 1, lot_number: "LOT", matches: [match()] });
    const result = validateScopedPageResponse(raw, 1, plan);
    expect(result.scoped_page_extraction?.scoped_results.map((row) => row.parameter_id)).toEqual(["temperature"]);
    expect(result.scoped_page_extraction?.scoped_results.some((row) => row.review_reasons.includes("PARAMETER_NOT_FOUND_ON_PAGE"))).toBe(false);
  });

  it("ignores out-of-scope parameter IDs and adds a page warning", () => {
    const raw = JSON.stringify({ page_number: 1, lot_number: "LOT", matches: [match(), match({ parameter_id: "unrequested", display_name: "Other" })] });
    const result = validateScopedPageResponse(raw, 1, plan);
    expect(result.scoped_page_extraction?.scoped_results.map((r) => r.parameter_id)).toEqual(["temperature"]);
    expect(result.scoped_page_extraction?.page_warnings).toContain("OUT_OF_SCOPE_PARAMETER_IGNORED");
  });

  it("allows duplicate matches for the same parameter on the same page", () => {
    const raw = JSON.stringify({ page_number: 1, matches: [match({ nearby_text: "Temp first occurrence" }), match({ actual_value: "36.9", nearby_text: "Temp second occurrence" })] });
    const result = validateScopedPageResponse(raw, 1, plan);
    expect(result.scoped_page_extraction?.scoped_results).toHaveLength(2);
    expect(result.scoped_page_extraction?.scoped_results.map((row) => row.nearby_text)).toEqual(["Temp first occurrence", "Temp second occurrence"]);
  });

  it("flags and repairs scoped page number mismatches", () => {
    const raw = JSON.stringify({ page_number: 99, matches: [match()] });
    const result = validateScopedPageResponse(raw, 2, plan);
    expect(result.scoped_page_extraction?.page_number).toBe(2);
    expect(result.scoped_page_extraction?.page_warnings).toContain("PAGE_NUMBER_MISMATCH");
    expect(result.scoped_page_extraction?.scoped_results[0].needs_review).toBe(true);
    expect(result.scoped_page_extraction?.scoped_results[0].review_reasons).toContain("PAGE_NUMBER_MISMATCH");
  });

  it("flags low confidence matches as needing review", () => {
    const raw = JSON.stringify({ page_number: 1, matches: [match({ extraction_confidence: 0.2 })] });
    const result = validateScopedPageResponse(raw, 1, plan);
    expect(result.scoped_page_extraction?.scoped_results[0].needs_review).toBe(true);
    expect(result.scoped_page_extraction?.scoped_results[0].review_reasons).toContain("LOW_CONFIDENCE");
  });
});
