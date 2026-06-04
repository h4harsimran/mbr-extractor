import type { PageProgress, ScopedExtractionPlan, ScopedExtractionResult } from "../types";

export type ScopedParameterMatchWithPage = ScopedExtractionResult & {
  page_number: number;
  lot_number?: string | null;
};

export type CompiledScopedParameter = {
  parameter_id: string;
  display_name: string;
  expected_units: string[];
  synonyms: string[];
  matches: ScopedParameterMatchWithPage[];
  overall_status: "matched" | "multiple_matches" | "not_found" | "needs_review";
};

export type CompiledScopedResult = {
  parameters: CompiledScopedParameter[];
  total_matches: number;
  not_found_count: number;
  needs_review_count: number;
};

export function compileScopedResults(scope: ScopedExtractionPlan, pages: PageProgress[]): CompiledScopedResult {
  const pageMatches = pages.flatMap((page) => {
    const extraction = page.scopedExtraction;
    if (!extraction) return [];
    return extraction.scoped_results.map((match) => ({ ...match, page_number: extraction.page_number, lot_number: extraction.lot_number }));
  });

  const parameters = scope.parameters.map<CompiledScopedParameter>((parameter) => {
    const matches = pageMatches.filter((match) => match.parameter_id === parameter.parameter_id);
    const hasReview = matches.some((match) => match.needs_review && match.review_status !== "accepted" && match.review_status !== "not_applicable");
    const overall_status: CompiledScopedParameter["overall_status"] = hasReview
      ? "needs_review"
      : matches.length === 0
        ? "not_found"
        : matches.length > 1
          ? "multiple_matches"
          : "matched";

    return {
      parameter_id: parameter.parameter_id,
      display_name: parameter.display_name,
      expected_units: [...parameter.expected_units],
      synonyms: [...parameter.synonyms],
      matches,
      overall_status,
    };
  });

  return {
    parameters,
    total_matches: parameters.reduce((sum, parameter) => sum + parameter.matches.length, 0),
    not_found_count: parameters.filter((parameter) => parameter.overall_status === "not_found").length,
    needs_review_count: parameters.filter((parameter) => parameter.overall_status === "needs_review" || parameter.overall_status === "not_found").length,
  };
}
