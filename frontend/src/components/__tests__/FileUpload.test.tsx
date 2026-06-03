import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileUpload from "../FileUpload";

describe("FileUpload", () => {
  it("shows inline errors", () => {
    render(<FileUpload onFileSelected={vi.fn()} error="File is too large" />);
    expect(screen.getByText("File is too large")).toBeInTheDocument();
  });
});
