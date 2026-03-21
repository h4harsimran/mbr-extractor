"""Pydantic v2 schemas for extraction data and API responses."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ── Extracted Row ───────────────────────────────────────────────────

class ExtractedRow(BaseModel):
    """One logical row / entry extracted from a MBR page."""

    page_number: int = Field(..., description="Page number this row was found on")
    row_id: Optional[str] = Field(None, description="Row identifier if visible")
    parameter_label: Optional[str] = Field(None, description="Printed parameter or label")
    target_value: Optional[str] = Field(None, description="Printed target / specification")
    actual_value: Optional[str] = Field(None, description="Handwritten actual value")
    units: Optional[str] = Field(None, description="Unit of measure")
    comments: Optional[str] = Field(None, description="Handwritten comments")
    performed_by_initials: Optional[str] = Field(None, description="Operator initials")
    performed_date: Optional[str] = Field(None, description="Date performed")
    verified_by_initials: Optional[str] = Field(None, description="Verifier initials")
    verified_date: Optional[str] = Field(None, description="Verification date")
    reviewer_notes: Optional[str] = Field(None, description="Extraction model notes")
    extraction_confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score 0–1"
    )
    needs_review: bool = Field(False, description="Flag for human review")
    source_image_path: Optional[str] = Field(None, description="Path to page image")

    @model_validator(mode="after")
    def auto_flag(self) -> "ExtractedRow":
        """Auto-flag rows that likely need human attention."""
        if self.actual_value is None:
            self.needs_review = True
        if self.performed_by_initials is None or self.verified_by_initials is None:
            self.needs_review = True
        return self


# ── Page-Level Extraction ───────────────────────────────────────────

class PageExtraction(BaseModel):
    """Gemini output for a single page."""

    page_number: int
    rows: list[ExtractedRow] = Field(default_factory=list)


# ── Document Metadata ──────────────────────────────────────────────

class DocumentMetadata(BaseModel):
    """Top-level document info."""

    document_id: str
    original_filename: str
    total_pages: int
    processed_at: Optional[str] = None


# ── Validation Result ──────────────────────────────────────────────

class ValidationResult(BaseModel):
    """Wrapper returned by the validator."""

    valid: bool
    errors: list[str] = Field(default_factory=list)
    page_extraction: Optional[PageExtraction] = None
    raw_text: Optional[str] = None


# ── API response helpers ───────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    total_pages: Optional[int] = None
    status: str
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


class PageResponse(BaseModel):
    id: int
    document_id: str
    page_number: int
    status: str
    image_path: Optional[str] = None
    raw_json_path: Optional[str] = None
    normalized_json_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    message: str
