import { describe, expect, it, vi, beforeEach } from "vitest";
import app from "../index";

const env = {
  GEMINI_API_KEY: "test-key",
  GEMINI_MODEL: "gemini-test",
  ALLOWED_ORIGINS: "https://example.com",
  MAX_REQUEST_BYTES: "2000",
  MAX_IMAGE_BASE64_CHARS: "1000",
};

const validBody = { image_base64: "aGVsbG8=", page_number: 1, mime_type: "image/jpeg" };
const modelJson = JSON.stringify({ page_number: 1, lot_number: "LOT-1", rows: [{ page_number: 1, row_id: "1", parameter_label: "Temp", actual_value: "37", performed_by_initials: "AB", verified_by_initials: "CD", extraction_confidence: 0.9 }] });

async function request(body: unknown, customEnv = env) {
  return app.request("/api/extract-page", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://example.com" }, body: typeof body === "string" ? body : JSON.stringify(body) }, customEnv);
}

describe("extract-page", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects invalid JSON before provider call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await request("{");
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects missing image", async () => expect((await request({ page_number: 1 })).status).toBe(400));
  it("rejects invalid base64", async () => expect((await request({ ...validBody, image_base64: "not base64!" })).status).toBe(400));
  it("rejects oversized image", async () => expect((await request({ ...validBody, image_base64: "a".repeat(1004) })).status).toBe(413));
  it("rejects unsupported MIME", async () => expect((await request({ ...validBody, mime_type: "application/pdf" })).status).toBe(400));
  it("rejects invalid page_number", async () => expect((await request({ ...validBody, page_number: 0 })).status).toBe(400));
  it("reports missing GEMINI_API_KEY", async () => expect((await request(validBody, { ...env, GEMINI_API_KEY: "" })).status).toBe(500));

  it("sanitizes provider failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("secret provider body", { status: 500 }));
    const res = await request(validBody);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ errors: [{ code: "PROVIDER_FAILED", message: "provider failed" }] });
  });

  it("handles invalid model JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }));
    expect((await request(validBody)).status).toBe(502);
  });

  it("handles schema mismatch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ page_number: -1, rows: [] }) }] } }] }));
    expect((await request(validBody)).status).toBe(502);
  });

  it("hides raw_text in production", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: modelJson }] } }] }));
    const json = await (await request(validBody)).json();
    expect(json.raw_text).toBeUndefined();
  });

  it("allows raw_text only in debug", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: modelJson }] } }] }));
    const json = await (await request(validBody, { ...env, DEBUG_RAW_MODEL_OUTPUT: "true" })).json();
    expect(json.raw_text).toBe(modelJson);
  });

  it("allows and denies CORS origins", async () => {
    const allowed = await app.request("/api/health", { headers: { Origin: "https://example.com" } }, env);
    const denied = await app.request("/api/health", { headers: { Origin: "https://evil.example" } }, env);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
