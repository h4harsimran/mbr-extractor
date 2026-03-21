"""Validate raw Gemini JSON against Pydantic schemas."""

import json
import logging
from typing import Optional

from pydantic import ValidationError

from app.schemas import ExtractedRow, PageExtraction, ValidationResult

logger = logging.getLogger(__name__)


def validate_page_response(raw_text: str, page_number: int) -> ValidationResult:
    """Parse and validate a raw Gemini JSON string.

    Returns a ``ValidationResult`` that indicates whether parsing succeeded,
    contains the validated ``PageExtraction`` on success, and a list of error
    messages on failure.
    """
    errors: list[str] = []

    # Step 1 — JSON parse
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        return ValidationResult(
            valid=False,
            errors=[f"JSON parse error: {exc}"],
            raw_text=raw_text,
        )

    # Step 2 — top-level structure checks
    if not isinstance(data, dict):
        return ValidationResult(
            valid=False,
            errors=["Top-level JSON is not an object"],
            raw_text=raw_text,
        )

    if "rows" not in data:
        # Allow empty-page responses by defaulting to empty rows list
        data["rows"] = []

    if "page_number" not in data:
        data["page_number"] = page_number

    # Step 3 — Pydantic validation
    try:
        page_extraction = PageExtraction.model_validate(data)
    except ValidationError as exc:
        return ValidationResult(
            valid=False,
            errors=[str(e) for e in exc.errors()],
            raw_text=raw_text,
        )

    # Step 4 — business-rule flagging (already partly handled by model_validator
    # on ExtractedRow, but we collect warnings here too)
    for row in page_extraction.rows:
        if row.actual_value is None and not row.needs_review:
            row.needs_review = True
            errors.append(
                f"Row {row.row_id}: actual_value is null — auto-flagged for review"
            )
        if row.performed_by_initials is None:
            errors.append(
                f"Row {row.row_id}: performed_by_initials missing — flagged"
            )
        if row.verified_by_initials is None:
            errors.append(
                f"Row {row.row_id}: verified_by_initials missing — flagged"
            )

    return ValidationResult(
        valid=True,
        errors=errors,  # may contain non-fatal warnings
        page_extraction=page_extraction,
        raw_text=raw_text,
    )
