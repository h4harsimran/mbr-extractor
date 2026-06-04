import assert from "node:assert/strict";
import { validatePageResponse } from "../src/lib/validator";
import { validateScopedPageResponse } from "../src/lib/scoped-extraction-validator";
import type { ScopedExtractionPlan } from "../src/lib/scope-schema";

const full = validatePageResponse(JSON.stringify({ page_number: 99, rows: [{ page_number: 99, actual_value: null, extraction_confidence: 0.2 }] }), 2);
assert.equal(full.valid, true);
assert.equal(full.page_extraction?.page_number, 2);
assert.equal(full.page_extraction?.warnings?.some((warning) => warning.code === "PAGE_NUMBER_MISMATCH"), true);
assert.equal(full.page_extraction?.rows[0].needs_review, true);

const plan: ScopedExtractionPlan = {
  scope_version: 1,
  document_type: "master_batch_record",
  extraction_mode: "scoped",
  parameters: [
    { parameter_id: "temperature", display_name: "Temperature", description: "", expected_units: ["°C"], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] },
    { parameter_id: "ph", display_name: "pH", description: "", expected_units: [], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] },
  ],
};
const scoped = validateScopedPageResponse(JSON.stringify({ page_number: 7, scoped_results: [{ parameter_id: "temperature", display_name: "Wrong", matched: true, actual_value: "37", extraction_confidence: 0.95, review_reasons: [] }, { parameter_id: "extra", display_name: "Extra", matched: true, extraction_confidence: 1 }] }), 3, plan);
assert.equal(scoped.valid, true);
assert.equal(scoped.scoped_page_extraction?.page_number, 3);
assert.deepEqual(scoped.scoped_page_extraction?.scoped_results.map((row) => row.parameter_id), ["temperature"]);
assert.equal(scoped.scoped_page_extraction?.scoped_results[0].needs_review, true);
assert.equal(scoped.scoped_page_extraction?.scoped_results[0].review_status, "open");
assert.equal(scoped.scoped_page_extraction?.scoped_results[0].review_reasons.includes("PAGE_NUMBER_MISMATCH"), true);
assert.equal(scoped.scoped_page_extraction?.page_warnings?.includes("PAGE_NUMBER_MISMATCH"), true);
assert.equal(scoped.scoped_page_extraction?.page_warnings?.includes("OUT_OF_SCOPE_PARAMETER_IGNORED"), true);
assert.equal(scoped.scoped_page_extraction?.scoped_results.some((row) => row.review_reasons.includes("PARAMETER_NOT_FOUND_ON_PAGE")), false);

console.log("worker smoke tests passed");
