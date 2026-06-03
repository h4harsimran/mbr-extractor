import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScopedExtractionSummary from "./ScopedExtractionSummary";

const pages = [{
  page_number: 1,
  lot_number: "LOT",
  scoped_results: [
    { parameter_id: "ph", display_name: "pH", matched: true, target_value: null, actual_value: "7.1", units: null, source_label: "pH", nearby_text: "pH 7.1", comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.9, needs_review: false, review_reasons: [] },
    { parameter_id: "do", display_name: "Dissolved oxygen", matched: false, target_value: null, actual_value: null, units: null, source_label: null, nearby_text: null, comments: null, performed_by_initials: null, performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0, needs_review: true, review_reasons: ["PARAMETER_NOT_FOUND_ON_PAGE"] },
  ],
}];

describe("ScopedExtractionSummary", () => {
  it("shows by-parameter view and missing rows in review view", () => {
    render(<ScopedExtractionSummary pages={pages} />);
    expect(screen.getByText("pH")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /review only/i }));
    expect(screen.getByText("Dissolved oxygen")).toBeInTheDocument();
    expect(screen.queryByText(/^pH$/)).not.toBeInTheDocument();
  });

  it("shows a by-page table", () => {
    render(<ScopedExtractionSummary pages={pages} />);
    fireEvent.click(screen.getByRole("button", { name: /by page/i }));
    expect(screen.getByText("Matched")).toBeInTheDocument();
  });
});
