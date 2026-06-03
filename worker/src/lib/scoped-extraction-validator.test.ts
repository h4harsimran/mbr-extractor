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

describe("scoped extraction validator", () => {
  it("keeps only requested parameters and marks missing parameters", () => {
    const raw = JSON.stringify({ page_number: 1, lot_number: "LOT", scoped_results: [{ parameter_id: "temperature", display_name: "Wrong", matched: true, actual_value: "37", extraction_confidence: 0.95, needs_review: false, review_reasons: [] }, { parameter_id: "unrequested", display_name: "Other", matched: true, extraction_confidence: 1 }] });
    const result = validateScopedPageResponse(raw, 1, plan);
    expect(result.valid).toBe(true);
    expect(result.scoped_page_extraction?.scoped_results.map((r) => r.parameter_id)).toEqual(["temperature", "ph"]);
    expect(result.scoped_page_extraction?.scoped_results[1]).toMatchObject({ matched: false, needs_review: true, review_reasons: ["PARAMETER_NOT_FOUND_ON_PAGE"] });
  });

  it("flags low confidence and missing actual value", () => {
    const raw = JSON.stringify({ page_number: 1, scoped_results: [{ parameter_id: "temperature", display_name: "Temperature", matched: true, actual_value: null, extraction_confidence: 0.2, needs_review: false, review_reasons: [] }] });
    const result = validateScopedPageResponse(raw, 1, { ...plan, parameters: [plan.parameters[0]] });
    expect(result.scoped_page_extraction?.scoped_results[0].review_reasons).toEqual(["MISSING_ACTUAL_VALUE", "LOW_CONFIDENCE"]);
  });
});
