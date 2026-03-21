"""Export normalized extraction data to a flattened CSV."""

import csv
import logging
from pathlib import Path

from app import db
from app.config import settings
from app.utils import load_json, doc_export_path

logger = logging.getLogger(__name__)

CSV_COLUMNS = [
    "document_id",
    "original_filename",
    "page_number",
    "row_id",
    "parameter_label",
    "target_value",
    "actual_value",
    "units",
    "comments",
    "performed_by_initials",
    "performed_date",
    "verified_by_initials",
    "verified_date",
    "extraction_confidence",
    "needs_review",
    "reviewer_notes",
    "source_image_path",
]


def export_csv(doc_id: str) -> Path:
    """Read all normalized JSON for *doc_id* and write a flattened CSV.

    Returns the path to the CSV file.
    """
    doc = db.get_document(doc_id)
    if doc is None:
        raise ValueError(f"Document {doc_id} not found")

    pages = db.get_pages(doc_id)
    csv_path = doc_export_path(doc_id)

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()

        for page in pages:
            norm_path = page.get("normalized_json_path")
            if not norm_path or not Path(norm_path).exists():
                continue

            data = load_json(Path(norm_path))
            rows = data.get("rows", [])

            for row in rows:
                flat = {
                    "document_id": doc_id,
                    "original_filename": doc["original_filename"],
                }
                for col in CSV_COLUMNS:
                    if col not in flat:
                        flat[col] = row.get(col)
                writer.writerow(flat)

    logger.info("Exported CSV: %s", csv_path)
    return csv_path
