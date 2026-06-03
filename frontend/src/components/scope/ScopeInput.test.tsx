import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScopeInput from "./ScopeInput";

describe("ScopeInput", () => {
  it("allows pasted parameter lists and disables build for empty input", () => {
    const onRawParametersChange = vi.fn();
    render(<ScopeInput rawParameters="" documentContext="" loading={false} onRawParametersChange={onRawParametersChange} onDocumentContextChange={vi.fn()} onBuildScope={vi.fn()} />);
    expect(screen.getByRole("button", { name: /build extraction scope/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/parameters to extract/i), { target: { value: "pH\nTemperature" } });
    expect(onRawParametersChange).toHaveBeenCalledWith("pH\nTemperature");
  });
});
