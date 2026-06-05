import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScopedExtractionSummary from "./ScopedExtractionSummary";
import type { CompiledScopedResult } from "../../lib/compile-scoped-results";

const pages = [{
  page_number: 1,
  lot_number: "LOT",
  scoped_results: [
    { parameter_id: "ph", display_name: "pH", matched: true, target_value: null, actual_value: "7.1", units: null, source_label: "pH", nearby_text: "pH 7.1", comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.9, needs_review: false, review_reasons: [] },
  ],
}, { page_number: 2, lot_number: null, scoped_results: [] }];

const compiled: CompiledScopedResult = {
  total_matches: 1,
  not_found_count: 1,
  row_review_count: 0,
  multiple_match_count: 0,
  action_required_count: 1,
  needs_review_count: 1,
  parameters: [
    { parameter_id: "ph", display_name: "pH", expected_units: [], synonyms: [], overall_status: "matched", matches: [{ ...pages[0].scoped_results[0], page_number: 1, row_index: 0, lot_number: "LOT" }] },
    { parameter_id: "do", display_name: "Dissolved oxygen", expected_units: [], synonyms: [], overall_status: "not_found", matches: [] },
  ],
};

describe("ScopedExtractionSummary", () => {
  it("shows compiled by-parameter view with document-level not found", () => {
    render(<ScopedExtractionSummary pages={pages} compiled={compiled} />);
    expect(screen.getByText("pH", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Dissolved oxygen", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("No match found anywhere in the processed pages.")).toBeInTheDocument();
  });

  it("shows a by-page empty state instead of missing rows", () => {
    render(<ScopedExtractionSummary pages={pages} compiled={compiled} />);
    fireEvent.click(screen.getByRole("button", { name: /by page/i }));
    expect(screen.getByText("No scoped parameters found on this page.")).toBeInTheDocument();
    expect(screen.queryByText("Dissolved oxygen")).not.toBeInTheDocument();
  });
});
