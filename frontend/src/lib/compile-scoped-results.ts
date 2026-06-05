import type { PageProgress, ScopedDocumentReviewStatus, ScopedExtractionPlan, ScopedExtractionResult, ScopedSelectedMatch } from "../types";

export type ScopedParameterMatchWithPage = ScopedExtractionResult & {
  page_number: number;
  row_index: number;
  lot_number?: string | null;
};

export type CompiledScopedParameter = {
  parameter_id: string;
  display_name: string;
  expected_units: string[];
  synonyms: string[];
  matches: ScopedParameterMatchWithPage[];
  overall_status: "matched" | "multiple_matches" | "not_found" | "needs_review" | "not_applicable";
};

export type CompiledScopedResult = {
  parameters: CompiledScopedParameter[];
  total_matches: number;
  not_found_count: number;
  row_review_count: number;
  multiple_match_count: number;
  action_required_count: number;
  /** @deprecated Use action_required_count, row_review_count, not_found_count, or multiple_match_count. */
  needs_review_count: number;
};

export type CompileScopedResultsOptions = {
  documentReviewStatuses?: Record<string, ScopedDocumentReviewStatus>;
  selectedMatches?: Record<string, ScopedSelectedMatch>;
};

const isSelectedMatch = (match: ScopedParameterMatchWithPage, selected?: ScopedSelectedMatch) =>
  Boolean(selected && match.page_number === selected.page_number && match.row_index === selected.row_index);

export function compileScopedResults(scope: ScopedExtractionPlan, pages: PageProgress[], options: CompileScopedResultsOptions = {}): CompiledScopedResult {
  const scopedParameterIds = new Set(scope.parameters.map((parameter) => parameter.parameter_id));
  const pageMatches = pages.flatMap((page) => {
    const extraction = page.scopedExtraction;
    if (!extraction) return [];
    return extraction.scoped_results
      .map((match, rowIndex) => ({ ...match, page_number: extraction.page_number, row_index: rowIndex, lot_number: extraction.lot_number }))
      .filter((match) => scopedParameterIds.has(match.parameter_id));
  });

  const parameters = scope.parameters.map<CompiledScopedParameter>((parameter) => {
    const allMatches = pageMatches.filter((match) => match.parameter_id === parameter.parameter_id);
    const selected = options.selectedMatches?.[parameter.parameter_id];
    const matches = selected && allMatches.some((match) => isSelectedMatch(match, selected))
      ? allMatches.filter((match) => isSelectedMatch(match, selected))
      : allMatches;
    const hasReview = matches.some((match) => match.needs_review && match.review_status !== "accepted" && match.review_status !== "not_applicable");
    const overall_status: CompiledScopedParameter["overall_status"] = options.documentReviewStatuses?.[parameter.parameter_id] === "not_applicable" && allMatches.length === 0
      ? "not_applicable"
      : hasReview
        ? "needs_review"
        : matches.length === 0
          ? "not_found"
          : selected && allMatches.length > 1 && matches.length === 1
            ? "matched"
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

  const rowReviewCount = parameters.reduce((sum, parameter) => sum + parameter.matches.filter((match) => match.needs_review && match.review_status !== "accepted" && match.review_status !== "not_applicable").length, 0);
  const notFoundCount = parameters.filter((parameter) => parameter.overall_status === "not_found").length;
  const multipleMatchCount = parameters.filter((parameter) => parameter.overall_status === "multiple_matches").length;
  const actionRequiredCount = rowReviewCount + notFoundCount + multipleMatchCount;

  return {
    parameters,
    total_matches: parameters.reduce((sum, parameter) => sum + parameter.matches.length, 0),
    not_found_count: notFoundCount,
    row_review_count: rowReviewCount,
    multiple_match_count: multipleMatchCount,
    action_required_count: actionRequiredCount,
    needs_review_count: actionRequiredCount,
  };
}
