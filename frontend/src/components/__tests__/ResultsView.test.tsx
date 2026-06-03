import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResultsView from "../ResultsView";

const page = { page_number: 1, lot_number: "LOT", rows: [{ page_number: 1, row_id: "1", parameter_label: "Temp", target_value: "37", actual_value: "36", units: "C", comments: null, performed_by_initials: "AB", performed_date: null, verified_by_initials: null, verified_date: null, extraction_confidence: 0.5, needs_review: true }] };

describe("ResultsView", () => {
  it("commits editable cell changes", () => {
    const onUpdateRow = vi.fn();
    render(<ResultsView pages={[page]} scopedPages={[]} extractionMode="full" allPages={[{ pageNumber: 1, status: "completed", extraction: page, error: null }]} filename="x.pdf" failedCount={0} pagePreviews={[]} onReset={vi.fn()} onUpdateRow={onUpdateRow} onUpdateScopedRow={vi.fn()} onRetryPage={vi.fn()} onRetryFailed={vi.fn()} />);
    const input = screen.getByDisplayValue("Temp");
    fireEvent.change(input, { target: { value: "Temperature" } });
    fireEvent.blur(input);
    expect(onUpdateRow).toHaveBeenCalledWith(1, 0, "parameter_label", "Temperature");
  });

  it("renders side-by-side review preview and queue rows", () => {
    render(<ResultsView pages={[page]} scopedPages={[]} extractionMode="full" allPages={[{ pageNumber: 1, status: "completed", extraction: page, scopedExtraction: null, error: null }]} pagePreviews={[{ pageNumber: 1, dataUrl: "data:image/jpeg;base64,abc", width: 100, height: 200 }]} filename="x.pdf" failedCount={0} onReset={vi.fn()} onUpdateRow={vi.fn()} onUpdateScopedRow={vi.fn()} onRetryPage={vi.fn()} onRetryFailed={vi.fn()} />);
    fireEvent.click(screen.getByText("Side-by-side review"));
    expect(screen.getByAltText("Rendered PDF page 1")).toBeInTheDocument();
    expect(screen.getAllByText("Temp").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/Review queue/));
    expect(screen.getByText(/Page 1: Temp/)).toBeInTheDocument();
  });

  it("shows failed page warning", () => {
    render(<ResultsView pages={[page]} scopedPages={[]} extractionMode="full" allPages={[{ pageNumber: 1, status: "completed", extraction: page, error: null }, { pageNumber: 2, status: "failed", extraction: null, error: "bad" }]} filename="x.pdf" failedCount={1} pagePreviews={[]} onReset={vi.fn()} onUpdateRow={vi.fn()} onUpdateScopedRow={vi.fn()} onRetryPage={vi.fn()} onRetryFailed={vi.fn()} />);
    expect(screen.getByText(/1 page failed/)).toBeInTheDocument();
  });
});
