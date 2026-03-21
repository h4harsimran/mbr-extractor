"""Tests for Pydantic schema validation."""

import pytest
from pydantic import ValidationError

from app.schemas import ExtractedRow, PageExtraction


class TestExtractedRow:
    """Validate ExtractedRow field constraints and auto-flagging."""

    def _base(self, **overrides) -> dict:
        row = {
            "page_number": 1,
            "row_id": "1",
            "parameter_label": "pH",
            "target_value": "7.0",
            "actual_value": "7.1",
            "units": "pH",
            "comments": None,
            "performed_by_initials": "JD",
            "performed_date": "2024-01-15",
            "verified_by_initials": "AB",
            "verified_date": "2024-01-15",
            "reviewer_notes": None,
            "extraction_confidence": 0.95,
            "needs_review": False,
            "source_image_path": "/images/page_0001.png",
        }
        row.update(overrides)
        return row

    def test_valid_row(self):
        row = ExtractedRow(**self._base())
        assert row.page_number == 1
        assert row.actual_value == "7.1"
        assert row.needs_review is False

    def test_confidence_out_of_range(self):
        with pytest.raises(ValidationError):
            ExtractedRow(**self._base(extraction_confidence=1.5))

    def test_confidence_negative(self):
        with pytest.raises(ValidationError):
            ExtractedRow(**self._base(extraction_confidence=-0.1))

    def test_null_actual_value_flags_review(self):
        row = ExtractedRow(**self._base(actual_value=None, needs_review=False))
        assert row.needs_review is True

    def test_missing_performed_by_flags_review(self):
        row = ExtractedRow(**self._base(performed_by_initials=None, needs_review=False))
        assert row.needs_review is True

    def test_missing_verified_by_flags_review(self):
        row = ExtractedRow(**self._base(verified_by_initials=None, needs_review=False))
        assert row.needs_review is True

    def test_all_optional_fields_null(self):
        row = ExtractedRow(
            page_number=1,
            extraction_confidence=0.5,
            needs_review=False,
        )
        assert row.needs_review is True  # auto-flagged because actual_value is None


class TestPageExtraction:
    """Validate PageExtraction structure."""

    def test_empty_rows(self):
        pe = PageExtraction(page_number=1, rows=[])
        assert pe.page_number == 1
        assert pe.rows == []

    def test_with_rows(self):
        pe = PageExtraction(
            page_number=2,
            rows=[
                ExtractedRow(
                    page_number=2,
                    row_id="1",
                    parameter_label="Temperature",
                    actual_value="25.0",
                    extraction_confidence=0.9,
                    needs_review=False,
                    performed_by_initials="JD",
                    verified_by_initials="AB",
                ),
            ],
        )
        assert len(pe.rows) == 1
        assert pe.rows[0].parameter_label == "Temperature"

    def test_page_number_required(self):
        with pytest.raises(ValidationError):
            PageExtraction(rows=[])
