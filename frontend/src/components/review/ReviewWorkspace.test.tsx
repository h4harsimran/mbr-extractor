import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReviewWorkspace from "./ReviewWorkspace";
import type { PageExtraction } from "../../types";

const pages: PageExtraction[] = [
  { page_number: 1, lot_number: null, rows: [{ page_number: 1, row_id: "1", parameter_label: "One", target_value: null, actual_value: "1", units: null, comments: null, performed_by_initials: "AA", performed_date: null, verified_by_initials: "BB", verified_date: null, extraction_confidence: 0.9, needs_review: false }] },
  { page_number: 2, lot_number: null, rows: [{ page_number: 2, row_id: "2", parameter_label: "Two", target_value: null, actual_value: "2", units: null, comments: null, performed_by_initials: "AA", performed_date: null, verified_by_initials: "BB", verified_date: null, extraction_confidence: 0.9, needs_review: true }] },
];

const props = { mode: "full" as const, pages, scopedPages: [], previews: [], onUpdateFullRow: vi.fn(), onUpdateScopedRow: vi.fn(), onRetryPage: vi.fn() };

describe("ReviewWorkspace", () => {
  it("syncs when initialPage changes", () => {
    const { rerender } = render(<ReviewWorkspace {...props} initialPage={1} initialRow={0} />);
    expect(screen.getAllByText(/Page 1/)[0]).toBeInTheDocument();
    rerender(<ReviewWorkspace {...props} initialPage={2} initialRow={0} />);
    expect(screen.getAllByText(/Page 2/)[0]).toBeInTheDocument();
  });

  it("falls back when initialPage is invalid", () => {
    render(<ReviewWorkspace {...props} initialPage={99} initialRow={0} />);
    expect(screen.getAllByText(/Page 1/)[0]).toBeInTheDocument();
  });

  it("syncs selected row from initialRow", () => {
    const { rerender } = render(<ReviewWorkspace {...props} initialPage={1} initialRow={null} />);
    rerender(<ReviewWorkspace {...props} initialPage={2} initialRow={0} />);
    expect(screen.getByText("Two")).toBeInTheDocument();
  });
});
