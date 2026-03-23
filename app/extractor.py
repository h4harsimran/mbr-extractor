"""Orchestrate the per-page extraction pipeline for a document."""

import logging
import shutil
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
    sanitize_filename,
)

logger = logging.getLogger(__name__)


def _ensure_general_product() -> str:
    """Find or create a 'General' product for unassigned batches."""
    prod = db.get_product_by_name("General")
    if prod:
        return prod["id"]
    new_prod = db.create_product("General", ["MBR"])
    return new_prod["id"]


def process_document(doc_id: str) -> list[ProcessingResult]:
    """Run the full extraction pipeline for a document.

    1. Render PDF → PNGs
    2. For each page: call Gemini → validate → persist
    3. Auto-detect Lot# and associate Batch
    4. Export CSV
    5. Auto-rename file
    6. Update document status
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
    detected_lot: str | None = None

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
                # Capture Lot# (prefer first page or non-null)
                if vr.page_extraction.lot_number and not detected_lot:
                    detected_lot = vr.page_extraction.lot_number
                    logger.info("Detected Lot# %s on page %d", detected_lot, pi.page_number)

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
                # Validation failure
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

    # ── Step 3: Auto-Detection & Batch Linking ──────────────────────
    if detected_lot and not doc.get("batch_id"):
        product_id = doc.get("product_id") or _ensure_general_product()
        
        batch = db.get_batch_by_lot(product_id, detected_lot)
        if not batch:
            logger.info("Creating new batch for Lot# %s", detected_lot)
            batch = db.create_batch(product_id, detected_lot)
        
        db.update_document(doc_id, product_id=product_id, batch_id=batch["id"])
        # Refresh local doc info for Step 5
        doc = db.get_document(doc_id)

    # ── Step 4: export CSV ──────────────────────────────────────────
    try:
        export_csv(doc_id)
    except Exception as exc:
        logger.warning("CSV export failed for %s: %s", doc_id, exc)

    # ── Step 5: Auto-Rename PDF ─────────────────────────────────────
    new_pdf_path = pdf_path
    if detected_lot:
        clean_lot = sanitize_filename(detected_lot)
        clean_type = sanitize_filename(doc.get("mbr_type") or "MBR")
        new_name = f"{clean_lot}_{clean_type}_{doc_id}.pdf"
        new_pdf_path = settings.uploads_dir / new_name
        
        try:
            shutil.move(pdf_path, new_pdf_path)
            logger.info("Renamed document %s to %s", pdf_path.name, new_name)
        except Exception as e:
            logger.warning("Failed to rename PDF %s: %s", pdf_path.name, e)

    # ── Step 6: final status ────────────────────────────────────────
    final_status = "failed" if any_failed else "completed"
    db.update_document(doc_id, status=final_status)

    return results
