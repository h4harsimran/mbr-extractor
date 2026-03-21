"""FastAPI application — routes and startup."""

import logging
import shutil
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import db
from app.config import settings
from app.extractor import process_document
from app.exporter import export_csv
from app.schemas import DocumentResponse, PageResponse, UploadResponse
from app.utils import (
    doc_export_path,
    doc_normalized_json_dir,
    doc_raw_json_dir,
    ensure_dir,
    generate_document_id,
    load_json,
)

# ── Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="MBR Extractor",
    description="Extract structured data from scanned Master Batch Record PDFs using Gemini multimodal.",
    version="0.1.0",
)

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

# Mount images directory so the review UI can display page images
ensure_dir(settings.images_dir)
app.mount("/images", StaticFiles(directory=str(settings.images_dir)), name="images")


@app.on_event("startup")
def startup() -> None:
    db.init_db()
    # Ensure data directories exist
    for d in [
        settings.uploads_dir,
        settings.images_dir,
        settings.raw_json_dir,
        settings.normalized_json_dir,
        settings.exports_dir,
    ]:
        ensure_dir(d)
    logger.info("MBR Extractor started  ✓")


# ── Upload ──────────────────────────────────────────────────────────

@app.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)):
    """Upload a PDF batch record for processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    doc_id = generate_document_id()
    dest = settings.uploads_dir / f"{doc_id}.pdf"
    ensure_dir(dest.parent)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    db.create_document(doc_id, file.filename)
    logger.info("Uploaded %s as %s", file.filename, doc_id)

    return UploadResponse(
        document_id=doc_id,
        filename=file.filename,
        message="PDF uploaded successfully. POST /process/{document_id} to start extraction.",
    )


# ── Process ─────────────────────────────────────────────────────────

@app.post("/process/{document_id}")
def trigger_processing(document_id: str):
    """Trigger extraction pipeline for a document."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc["status"] == "processing":
        raise HTTPException(status_code=409, detail="Document is already processing")

    try:
        results = process_document(document_id)
        return {
            "document_id": document_id,
            "status": "completed" if all(r.success for r in results) else "completed_with_errors",
            "pages_processed": len(results),
            "pages_succeeded": sum(1 for r in results if r.success),
            "pages_failed": sum(1 for r in results if not r.success),
            "total_rows_extracted": sum(r.total_rows for r in results),
            "rows_needing_review": sum(r.needs_review_count for r in results),
        }
    except Exception as exc:
        logger.exception("Processing failed for %s", document_id)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Document list / detail ──────────────────────────────────────────

@app.get("/documents", response_model=list[DocumentResponse])
def list_documents():
    """List all documents."""
    return db.list_documents()


@app.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str):
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ── Pages ───────────────────────────────────────────────────────────

@app.get("/documents/{document_id}/pages", response_model=list[PageResponse])
def get_pages(document_id: str):
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return db.get_pages(document_id)


# ── Raw / Normalized JSON ──────────────────────────────────────────

@app.get("/documents/{document_id}/raw")
def get_raw_json(document_id: str):
    """Return all raw Gemini responses for a document."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    raw_dir = doc_raw_json_dir(document_id)
    files = sorted(raw_dir.glob("*.json"))
    if not files:
        return {"document_id": document_id, "pages": []}

    pages = []
    for f in files:
        try:
            pages.append({"file": f.name, "data": load_json(f)})
        except Exception:
            pages.append({"file": f.name, "error": "Could not parse"})
    return {"document_id": document_id, "pages": pages}


@app.get("/documents/{document_id}/normalized")
def get_normalized_json(document_id: str):
    """Return all normalized JSON for a document."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    norm_dir = doc_normalized_json_dir(document_id)
    files = sorted(norm_dir.glob("*.json"))
    if not files:
        return {"document_id": document_id, "pages": []}

    pages = []
    for f in files:
        try:
            pages.append({"file": f.name, "data": load_json(f)})
        except Exception:
            pages.append({"file": f.name, "error": "Could not parse"})
    return {"document_id": document_id, "pages": pages}


# ── CSV export ──────────────────────────────────────────────────────

@app.get("/documents/{document_id}/export/csv")
def export_csv_route(document_id: str):
    """Download the flattened CSV for a document."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    csv_path = doc_export_path(document_id)
    if not csv_path.exists():
        # Try generating
        try:
            export_csv(document_id)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"CSV export failed: {exc}")

    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="No CSV available")

    return FileResponse(
        path=str(csv_path),
        media_type="text/csv",
        filename=f"{document_id}.csv",
    )


# ── Review UI ───────────────────────────────────────────────────────

@app.get("/review", response_class=HTMLResponse)
def review_dashboard(request: Request):
    """HTML dashboard listing all documents with upload form."""
    docs = db.list_documents()
    return templates.TemplateResponse(
        "review_dashboard.html",
        {"request": request, "documents": docs},
    )


@app.get("/review/{document_id}", response_class=HTMLResponse)
def review_document(request: Request, document_id: str, status: str = "", review: str = ""):
    """Per-document review page — shows pages, images, extracted data."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    pages = db.get_pages(document_id)

    # Filter by status if requested
    if status:
        pages = [p for p in pages if p["status"] == status]

    # Enrich pages with extracted data
    enriched_pages = []
    for page in pages:
        enriched = dict(page)

        # Load normalized JSON if available
        norm_path = page.get("normalized_json_path")
        if norm_path and Path(norm_path).exists():
            try:
                enriched["normalized_data"] = load_json(Path(norm_path))
            except Exception:
                enriched["normalized_data"] = None
        else:
            enriched["normalized_data"] = None

        # Load raw JSON if available
        raw_path = page.get("raw_json_path")
        if raw_path and Path(raw_path).exists():
            try:
                enriched["raw_data"] = Path(raw_path).read_text(encoding="utf-8")
            except Exception:
                enriched["raw_data"] = None
        else:
            enriched["raw_data"] = None

        # Build image URL
        if page.get("image_path"):
            img_path = Path(page["image_path"])
            # Relative to images mount
            try:
                rel = img_path.relative_to(settings.images_dir)
                enriched["image_url"] = f"/images/{rel}"
            except ValueError:
                enriched["image_url"] = None
        else:
            enriched["image_url"] = None

        # Filter by needs_review
        if review == "flagged" and enriched.get("normalized_data"):
            rows = enriched["normalized_data"].get("rows", [])
            flagged = [r for r in rows if r.get("needs_review")]
            if not flagged:
                continue  # skip pages with no flagged rows
            enriched["normalized_data"]["rows"] = flagged

        enriched_pages.append(enriched)

    return templates.TemplateResponse(
        "review_document.html",
        {
            "request": request,
            "document": doc,
            "pages": enriched_pages,
            "status_filter": status,
            "review_filter": review,
        },
    )


# ── Data Viewer ─────────────────────────────────────────────────────

@app.get("/data/{document_id}", response_class=HTMLResponse)
def data_viewer(request: Request, document_id: str):
    """Interactive data viewer with column toggles, filters, and sorting."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    return templates.TemplateResponse(
        "data_viewer.html",
        {"request": request, "document": doc},
    )
