import type { ScopedExtractionPlan } from "../scope-schema";

export const SCOPED_EXTRACTION_SYSTEM_PROMPT = `You are an expert document extraction model for manufacturing batch records (MBR).
Review the page against the validated scoped extraction plan. Extract only parameters from that scope that are present, likely present, or ambiguously present on this page.
Do not extract unrelated rows. Do not invent values. Use null for missing fields within a returned match. Include source evidence.
Return JSON only. Do not include markdown or commentary.`;

export function buildScopedExtractionPrompt({ pageNumber, scopedPlan }: { pageNumber: number; scopedPlan: ScopedExtractionPlan }): string {
  return `Extract scoped MBR values from page ${pageNumber} using only this validated normalized scope plan:
${JSON.stringify(scopedPlan)}

Rules:
- Return only parameters from the scope that are present, likely present, or ambiguous on this page.
- Do not return entries for parameters that are clearly absent from this page.
- Do not create matched=false rows.
- Do not report parameter-not-found at page level.
- The final application will determine which parameters were not found anywhere in the processed document.
- If no scoped parameters are present on this page, return an empty matches array.
- Use only parameter IDs from the provided scope. Do not extract parameters outside the provided scope.
- If a scoped parameter appears multiple times on the same page, return multiple matches or include enough step/source context to distinguish them.
- Do not invent values. Use null for fields that are not visible within an otherwise relevant match.
- Include source evidence with source_label and nearby_text.
- Mark ambiguous, uncertain, missing-value, low-confidence (<0.7), or unit-mismatch matches with needs_review=true and review_reasons.
- Extract Batch Lot Number if visible in header/footer/metadata.
- Output JSON only.

Required output schema and example:
{
  "page_number": 4,
  "lot_number": "LOT-123",
  "matches": [
    {
      "parameter_id": "bioreactor_temperature",
      "display_name": "Bioreactor temperature",
      "target_value": "37",
      "actual_value": "37.1",
      "units": "°C",
      "source_label": "Culture temperature",
      "nearby_text": "Culture temperature target 37°C actual 37.1°C",
      "comments": null,
      "performed_by_initials": "AB",
      "performed_date": "2026-01-15",
      "verified_by_initials": "CD",
      "verified_date": "2026-01-15",
      "extraction_confidence": 0.92,
      "needs_review": false,
      "review_reasons": [],
      "review_status": "accepted"
    }
  ],
  "page_warnings": []
}

No-match example:
{
  "page_number": ${pageNumber},
  "lot_number": null,
  "matches": [],
  "page_warnings": []
}`;
}
