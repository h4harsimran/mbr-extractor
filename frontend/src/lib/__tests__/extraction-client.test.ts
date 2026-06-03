import { describe, expect, it, vi } from "vitest";
import { extractPageFromApi } from "../extraction-client";

describe("extraction client", () => {
  it("returns API error shape for failed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ success: false, page_extraction: null, errors: [{ code: "INVALID_REQUEST", message: "invalid request" }] }, { status: 400 }));
    const result = await extractPageFromApi("aGVsbG8=", 1);
    expect(result.success).toBe(false);
    expect(result.errors[0].code).toBe("INVALID_REQUEST");
  });
});
