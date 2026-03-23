import uuid
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
import json
import shutil

from app import db
from app.extractor import process_document
from app.models import ProcessingResult
from app.config import settings

@pytest.fixture
def mock_pipeline_deps(monkeypatch):
    """Mock external dependencies for process_document."""
    mock_render = MagicMock(return_value=[MagicMock(page_number=1, image_path="page1.png")])
    mock_extract = MagicMock(return_value=json.dumps({
        "page_number": 1,
        "lot_number": "LOT-999",
        "rows": [
            {
                "page_number": 1,
                "row_id": "1",
                "parameter_label": "Temp",
                "actual_value": "37",
                "extraction_confidence": 0.9,
                "needs_review": False
            }
        ]
    }))
    mock_export = MagicMock()
    
    monkeypatch.setattr("app.extractor.render_pdf", mock_render)
    monkeypatch.setattr("app.extractor.extract_page", mock_extract)
    monkeypatch.setattr("app.extractor.export_csv", mock_export)
    
    return {
        "render": mock_render,
        "extract": mock_extract,
        "export": mock_export
    }

def test_lot_detection_and_auto_linking(mock_pipeline_deps, tmp_path):
    # 1. Setup DB with a document
    doc_id = f"test_{uuid.uuid4().hex[:8]}"
    db.create_document(doc_id, "original.pdf")
    
    # 2. Setup mock file
    pdf_file = settings.uploads_dir / f"{doc_id}.pdf"
    pdf_file.touch()
    
    try:
        # 3. Run processing
        results = process_document(doc_id)
        
        # 4. Assertions
        assert len(results) == 1
        assert results[0].success is True
        
        # Check DB was updated with lot and batch
        updated_doc = db.get_document(doc_id)
        assert updated_doc["product_id"] is not None
        assert updated_doc["batch_id"] is not None
        
        batch = db.get_batch(updated_doc["batch_id"])
        assert batch["lot_number"] == "LOT-999"
        
        # Check file was renamed
        # Format: [Lot#]_[MBR_Type]_[doc_id].pdf -> LOT-999_MBR_testdoc123.pdf
        renamed_path = settings.uploads_dir / f"LOT-999_MBR_{doc_id}.pdf"
        assert renamed_path.exists()
        assert not pdf_file.exists()
        
    finally:
        # Cleanup
        if (settings.uploads_dir / f"LOT-999_MBR_{doc_id}.pdf").exists():
            (settings.uploads_dir / f"LOT-999_MBR_{doc_id}.pdf").unlink()
        if pdf_file.exists():
            pdf_file.unlink()

def test_no_lot_detected_keeps_name(mock_pipeline_deps):
    # Override extract to return no lot
    mock_pipeline_deps["extract"].return_value = json.dumps({
        "page_number": 1,
        "lot_number": None,
        "rows": []
    })
    
    # 1. Setup DB with a document
    doc_id = f"test_no_{uuid.uuid4().hex[:8]}"
    db.create_document(doc_id, "no_lot.pdf")
    pdf_file = settings.uploads_dir / f"{doc_id}.pdf"
    pdf_file.touch()
    
    try:
        process_document(doc_id)
        
        updated_doc = db.get_document(doc_id)
        assert updated_doc["batch_id"] is None
        assert pdf_file.exists()
        
    finally:
        if pdf_file.exists():
            pdf_file.unlink()
