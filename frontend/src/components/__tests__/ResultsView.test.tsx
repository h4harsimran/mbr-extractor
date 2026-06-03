import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResultsView from "../ResultsView";

const page = { page_number: 1, lot_number: "LOT", rows: [{ page_number: 1, row_id: "1", parameter_label: "Temp", target_value: "37", actual_value: "36", units: "C", comments: null, performed_by_initials: "AB", performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.5, needs_review: true }] };

describe("ResultsView", () => {
  it("commits editable cell changes", () => {
    const onUpdateRow = vi.fn();
    render(<ResultsView pages={[page]} scopedPages={[]} extractionMode="full" allPages={[{ pageNumber: 1, status: "completed", extraction: page, error: null }]} filename="x.pdf" failedCount={0} onReset={vi.fn()} onUpdateRow={onUpdateRow} onRetryPage={vi.fn()} onRetryFailed={vi.fn()} />);
    const input = screen.getByDisplayValue("Temp");
    fireEvent.change(input, { target: { value: "Temperature" } });
    fireEvent.blur(input);
    expect(onUpdateRow).toHaveBeenCalledWith(1, 0, "parameter_label", "Temperature");
  });

  it("shows failed page warning", () => {
    render(<ResultsView pages={[page]} scopedPages={[]} extractionMode="full" allPages={[{ pageNumber: 1, status: "completed", extraction: page, error: null }, { pageNumber: 2, status: "failed", extraction: null, error: "bad" }]} filename="x.pdf" failedCount={1} onReset={vi.fn()} onUpdateRow={vi.fn()} onRetryPage={vi.fn()} onRetryFailed={vi.fn()} />);
    expect(screen.getByText(/1 page failed/)).toBeInTheDocument();
  });
});
