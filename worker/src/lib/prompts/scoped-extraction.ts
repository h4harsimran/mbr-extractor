import type { ScopedExtractionPlan } from "../scope-schema";

export const SCOPED_EXTRACTION_SYSTEM_PROMPT = `You are an expert document extraction model for manufacturing batch records (MBR).
Extract only the parameters listed in the validated scoped extraction plan. Do not extract unrelated rows.
Never invent values. Use null for missing fields. Preserve source wording where useful.
Return JSON only. Do not include markdown or commentary.`;

export function buildScopedExtractionPrompt({ pageNumber, scopedPlan }: { pageNumber: number; scopedPlan: ScopedExtractionPlan }): string {
  return `Extract scoped MBR values from page ${pageNumber} using only this validated normalized scope plan:
${JSON.stringify(scopedPlan)}

Rules:
- Return one scoped_results item for every parameter in the plan.
- If a parameter is not visible on this page, set matched=false, all value/evidence fields null, extraction_confidence=0, needs_review=true, and review_reasons=["PARAMETER_NOT_FOUND_ON_PAGE"].
- For matched parameters, include target_value and actual_value only when visible; never guess.
- Include source_label and nearby_text evidence for traceability.
- Flag ambiguous, missing actual values, low confidence (<0.7), or unit mismatches with needs_review=true and review_reasons.
- Extract Batch Lot Number if visible in header/footer/metadata.

Required output schema:
{
  "page_number": ${pageNumber},
  "lot_number": "<extracted Lot# or null>",
  "scoped_results": [
    {
      "parameter_id": "<id from scope>",
      "display_name": "<name from scope>",
      "matched": true,
      "target_value": "<target or null>",
      "actual_value": "<actual or null>",
      "units": "<units or null>",
      "source_label": "<visible label or null>",
      "nearby_text": "<short evidence text or null>",
      "comments": "<comments or null>",
      "performed_by_initials": "<initials or null>",
      "performed_date": "<date or null>",
      "verified_by_initials": "<initials or null>",
      "verified_date": "<date or null>",
      "extraction_confidence": 0.0,
      "needs_review": true,
      "review_reasons": []
    }
  ]
}`;
}
