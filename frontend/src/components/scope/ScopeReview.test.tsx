import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScopeReview from "./ScopeReview";
import type { ScopedExtractionPlan } from "../../types";

const scope: ScopedExtractionPlan = {
  scope_version: 1,
  document_type: "master_batch_record",
  extraction_mode: "scoped",
  parameters: [{ parameter_id: "ph", display_name: "pH", description: "", expected_units: [], synonyms: ["acidity"], value_types: ["actual_value"], required_evidence: ["page_number"], needs_review_rules: [] }],
};

describe("ScopeReview", () => {
  it("displays generated scope and allows removing a parameter", () => {
    const onChange = vi.fn();
    render(<ScopeReview scope={scope} approved={false} onChange={onChange} onApprove={vi.fn()} />);
    expect(screen.getByDisplayValue("pH")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(onChange).toHaveBeenCalledWith({ ...scope, parameters: [] });
  });

  it("approves scope before extraction", () => {
    const onApprove = vi.fn();
    render(<ScopeReview scope={scope} approved={false} onChange={vi.fn()} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: /approve scope/i }));
    expect(onApprove).toHaveBeenCalled();
  });
});
