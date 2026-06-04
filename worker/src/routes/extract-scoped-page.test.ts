import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";

const env = { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-test", ALLOWED_ORIGINS: "https://example.com", MAX_REQUEST_BYTES: "5000", MAX_IMAGE_BASE64_CHARS: "1000" };
const scope = {
  scope_version: 1,
  document_type: "master_batch_record",
  extraction_mode: "scoped",
  parameters: [{ parameter_id: "ph", display_name: "pH", description: "Extract pH.", expected_units: [], synonyms: [], value_types: ["actual_value"], required_evidence: ["page_number", "source_label", "nearby_text"], needs_review_rules: ["low_confidence"] }],
};
const validBody = { image_base64: "aGVsbG8=", page_number: 1, mime_type: "image/jpeg", extraction_mode: "scoped", scope };
const geminiResponse = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });

function request(body: unknown) {
  return app.request("/api/extract-page", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.com" }, body: JSON.stringify(body) }, env);
}

describe("extract scoped page", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects invalid scope without calling Gemini", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await request({ ...validBody, scope: { parameters: [] } });
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns only requested scoped parameters", async () => {
    const raw = JSON.stringify({ page_number: 1, lot_number: "LOT", scoped_results: [{ parameter_id: "ph", display_name: "pH", matched: true, actual_value: "7.1", units: null, extraction_confidence: 0.9, needs_review: false, review_reasons: [] }, { parameter_id: "other", display_name: "Other", matched: true, extraction_confidence: 1 }] });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(geminiResponse(raw));
    const json = await (await request(validBody)).json();
    expect(json.success).toBe(true);
    expect(json.page_extraction).toBeNull();
    expect(json.scoped_page_extraction.scoped_results).toHaveLength(1);
    expect(json.scoped_page_extraction.scoped_results[0]).toMatchObject({ parameter_id: "ph", actual_value: "7.1" });
  });

  it("returns an empty matches array when scoped parameters are absent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(geminiResponse(JSON.stringify({ page_number: 1, matches: [] })));
    const json = await (await request(validBody)).json();
    expect(json.scoped_page_extraction.scoped_results).toEqual([]);
    expect(json.scoped_page_extraction.matches).toEqual([]);
  });
});
