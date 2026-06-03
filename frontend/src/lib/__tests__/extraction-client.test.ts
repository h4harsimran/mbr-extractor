import { describe, expect, it, vi } from "vitest";
import { extractPageFromApi } from "../extraction-client";

const scope = { scope_version: 1 as const, document_type: "master_batch_record" as const, extraction_mode: "scoped" as const, parameters: [{ parameter_id: "ph", display_name: "pH", description: "Extract pH.", expected_units: [], synonyms: [], value_types: ["actual_value" as const], required_evidence: ["page_number" as const, "source_label" as const, "nearby_text" as const], needs_review_rules: [] }] };

describe("extraction client", () => {
  it("returns API error shape for failed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ success: false, page_extraction: null, errors: [{ code: "INVALID_REQUEST", message: "invalid request" }] }, { status: 400 }));
    const result = await extractPageFromApi("aGVsbG8=", 1, "full");
    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe("INVALID_REQUEST");
  });

  it("does not call extraction API for scoped mode without valid scope", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await extractPageFromApi("aGVsbG8=", 1, "scoped");
    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe("MISSING_SCOPE");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends explicit scoped extraction mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ success: true, page_extraction: null, scoped_page_extraction: { page_number: 1, lot_number: null, scoped_results: [] }, errors: [] }));
    await extractPageFromApi("aGVsbG8=", 1, "scoped", "image/jpeg", undefined, scope);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).extraction_mode).toBe("scoped");
  });
});
