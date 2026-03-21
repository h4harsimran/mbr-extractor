"""Tests for CSV export logic."""

import csv
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest


# We need to set up a test environment before importing app modules
@pytest.fixture(autouse=True)
def _setup_env(tmp_path, monkeypatch):
    """Point data directories to temp for test isolation."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("DB_PATH", str(tmp_path / "data" / "test.db"))
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    # Re-import with patched env
    from app.config import Settings
    test_settings = Settings()
    monkeypatch.setattr("app.config.settings", test_settings)
    monkeypatch.setattr("app.db.settings", test_settings)
    monkeypatch.setattr("app.utils.settings", test_settings)
    monkeypatch.setattr("app.exporter.settings", test_settings)

    # Init DB
    from app.db import init_db
    init_db()

    yield test_settings


def _make_normalized_json() -> dict:
    """Sample normalized page extraction data."""
    return {
        "page_number": 1,
        "rows": [
            {
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
                "extraction_confidence": 0.95,
                "needs_review": False,
                "reviewer_notes": None,
                "source_image_path": "/images/doc1/page_0001.png",
            },
            {
                "page_number": 1,
                "row_id": "2",
                "parameter_label": "Temperature",
                "target_value": "25 °C",
                "actual_value": "24.8",
                "units": "°C",
                "comments": "Within spec",
                "performed_by_initials": "JD",
                "performed_date": "2024-01-15",
                "verified_by_initials": "AB",
                "verified_date": "2024-01-15",
                "extraction_confidence": 0.88,
                "needs_review": False,
                "reviewer_notes": None,
                "source_image_path": "/images/doc1/page_0001.png",
            },
        ],
    }


class TestCSVExport:
    def test_export_creates_csv(self, _setup_env):
        from app import db
        from app.exporter import export_csv, CSV_COLUMNS
        from app.utils import ensure_dir

        settings = _setup_env
        doc_id = "test_doc_001"
        db.create_document(doc_id, "batch_record.pdf")

        # Create normalized JSON
        norm_dir = ensure_dir(settings.normalized_json_dir / doc_id)
        norm_file = norm_dir / "page_0001_normalized.json"
        norm_file.write_text(json.dumps(_make_normalized_json()), encoding="utf-8")

        # Create page record pointing to the file
        page_id = db.create_page(doc_id, 1, "/images/doc1/page_0001.png")
        db.update_page(page_id, normalized_json_path=str(norm_file))

        # Export
        csv_path = export_csv(doc_id)

        assert csv_path.exists()

        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 2
        assert set(reader.fieldnames) == set(CSV_COLUMNS)
        assert rows[0]["parameter_label"] == "pH"
        assert rows[1]["parameter_label"] == "Temperature"
        assert rows[0]["document_id"] == doc_id
        assert rows[0]["original_filename"] == "batch_record.pdf"

    def test_export_no_pages(self, _setup_env):
        from app import db
        from app.exporter import export_csv

        doc_id = "empty_doc_002"
        db.create_document(doc_id, "empty.pdf")

        csv_path = export_csv(doc_id)
        assert csv_path.exists()

        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 0
