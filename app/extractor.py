"""Orchestrate the per-page extraction pipeline for a document."""

import logging
from datetime import datetime, timezone
from pathlib import Path

from app import db
from app.config import settings
from app.gemini_client import extract_page
from app.models import ProcessingResult
from app.pdf_renderer import render_pdf
from app.validator import validate_page_response
from app.exporter import export_csv
from app.utils import (
    save_json,
    page_raw_json_path,
    page_normalized_json_path,
)

logger = logging.getLogger(__name__)


def process_document(doc_id: str) -> list[ProcessingResult]:
    """Run the full extraction pipeline for a document.

    1. Render PDF → PNGs
    2. For each page: call Gemini → validate → persist
    3. Export CSV
    4. Update document status
    """
    doc = db.get_document(doc_id)
    if doc is None:
        raise ValueError(f"Document {doc_id} not found")

    pdf_path = settings.uploads_dir / f"{doc_id}.pdf"
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    db.update_document(doc_id, status="processing")

    # ── Step 1: render ──────────────────────────────────────────────
    logger.info("Rendering PDF %s …", pdf_path.name)
    page_images = render_pdf(pdf_path, doc_id)
    total_pages = len(page_images)
    db.update_document(doc_id, total_pages=total_pages)

    # Create page records
    for pi in page_images:
        db.create_page(doc_id, pi.page_number, pi.image_path)

    # ── Step 2: extract + validate each page ────────────────────────
    results: list[ProcessingResult] = []
    any_failed = False

    for pi in page_images:
        page_rec = db.get_page(doc_id, pi.page_number)
        page_id = page_rec["id"]
        db.update_page(page_id, status="processing")

        try:
            # Call Gemini
            raw_json_str = extract_page(pi.image_path, pi.page_number)

            # Persist raw
            raw_path = page_raw_json_path(doc_id, pi.page_number)
            raw_path.write_text(raw_json_str, encoding="utf-8")

            # Validate
            vr = validate_page_response(raw_json_str, pi.page_number)

            if vr.valid and vr.page_extraction is not None:
                # Inject source_image_path into each row
                for row in vr.page_extraction.rows:
                    row.source_image_path = pi.image_path

                normalized = vr.page_extraction.model_dump(mode="json")
                norm_path = page_normalized_json_path(doc_id, pi.page_number)
                save_json(normalized, norm_path)

                needs_review_count = sum(
                    1 for r in vr.page_extraction.rows if r.needs_review
                )
                total_rows = len(vr.page_extraction.rows)

                db.update_page(
                    page_id,
                    status="completed",
                    raw_json_path=str(raw_path),
                    normalized_json_path=str(norm_path),
                )

                results.append(
                    ProcessingResult(
                        page_number=pi.page_number,
                        success=True,
                        raw_json_path=str(raw_path),
                        normalized_json_path=str(norm_path),
                        needs_review_count=needs_review_count,
                        total_rows=total_rows,
                    )
                )
            else:
                # Validation failure — still save raw
                error_msg = "; ".join(vr.errors) if vr.errors else "Validation failed"
                db.update_page(
                    page_id,
                    status="failed",
                    raw_json_path=str(raw_path),
                    error_message=error_msg,
                )
                results.append(
                    ProcessingResult(
                        page_number=pi.page_number,
                        success=False,
                        raw_json_path=str(raw_path),
                        error=error_msg,
                    )
                )
                any_failed = True

        except Exception as exc:
            logger.exception("Failed to process page %d of %s", pi.page_number, doc_id)
            db.update_page(page_id, status="failed", error_message=str(exc))
            results.append(
                ProcessingResult(
                    page_number=pi.page_number, success=False, error=str(exc)
                )
            )
            any_failed = True

    # ── Step 3: export CSV ──────────────────────────────────────────
    try:
        export_csv(doc_id)
    except Exception as exc:
        logger.warning("CSV export failed for %s: %s", doc_id, exc)

    # ── Step 4: final status ────────────────────────────────────────
    final_status = "failed" if any_failed else "completed"
    db.update_document(doc_id, status=final_status)

    return results
