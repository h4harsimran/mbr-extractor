"""FastAPI application — routes and startup."""

import logging
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, Form
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app import db
from app.config import settings
from app.extractor import process_document
from app.exporter import export_csv
from app.schemas import (
    DocumentResponse,
    PageResponse,
    UploadResponse,
    ProductResponse,
    BatchResponse,
    RowUpdateRequest,
    PageExtraction,
)
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

# ── Auth middleware (disabled when SUPABASE_JWT_SECRET is empty) ────
from app.auth import AuthMiddleware
app.add_middleware(AuthMiddleware)

templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

# Prevent stale HTML from BFCache, CDN layers, and intermediary proxies.
_HTML_NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


# ── Public routes ───────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={
            "supabase_url": settings.supabase_url,
            "supabase_anon_key": settings.supabase_anon_key,
        },
    )

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
async def upload_pdf(
    file: UploadFile = File(...),
    product_id: Optional[str] = Form(None),
    batch_id: Optional[str] = Form(None),
    mbr_type: Optional[str] = Form(None)
):
    """Upload a PDF batch record for processing."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    doc_id = generate_document_id()
    dest = settings.uploads_dir / f"{doc_id}.pdf"
    ensure_dir(dest.parent)

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    db.create_document(doc_id, file.filename, product_id=product_id, batch_id=batch_id, mbr_type=mbr_type)
    logger.info("Uploaded %s as %s (Product: %s, Batch: %s)", file.filename, doc_id, product_id, batch_id)

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


@app.put("/api/documents/{document_id}/pages/{page_number}/rows/{row_index}")
def update_row(document_id: str, page_number: int, row_index: int, update: RowUpdateRequest):
    """Update human-reviewed fields in a specific row and clear its review flag."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.utils import page_normalized_json_path
    
    norm_path = page_normalized_json_path(document_id, page_number)
    if not norm_path.exists():
        raise HTTPException(status_code=404, detail="Page data not found")
        
    data = load_json(norm_path)
    page_data = PageExtraction.model_validate(data)
    
    if row_index < 0 or row_index >= len(page_data.rows):
        raise HTTPException(status_code=404, detail="Row not found")
        
    row = page_data.rows[row_index]
    
    # Update fields that were provided
    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(row, key, value)
        
    # Re-save
    from app.utils import save_json
    save_json(page_data.model_dump(mode="json"), norm_path)
    
    # Invalidate CSV cache
    csv_path = doc_export_path(document_id)
    if csv_path.exists():
        csv_path.unlink()
        
    return {"status": "ok", "row": row.model_dump(mode="json")}


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
        request=request,
        name="review_dashboard.html",
        context={"documents": docs},
        headers=_HTML_NO_STORE_HEADERS,
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
        request=request,
        name="review_document.html",
        context={
            "document": doc,
            "pages": enriched_pages,
            "status_filter": status,
            "review_filter": review,
        },
        headers=_HTML_NO_STORE_HEADERS,
    )


# ── Data Viewer ─────────────────────────────────────────────────────

@app.get("/data/{document_id}", response_class=HTMLResponse)
def data_viewer(request: Request, document_id: str):
    """Interactive data viewer with column toggles, filters, and sorting."""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return templates.TemplateResponse(
        request=request,
        name="data_viewer.html",
        context={"document": doc},
        headers=_HTML_NO_STORE_HEADERS,
    )


# ── Products & Batches (Advanced UI) ────────────────────────────────

@app.get("/products", response_class=HTMLResponse)
def list_products_ui(request: Request):
    """HTML page listing all products."""
    products = db.list_products()
    return templates.TemplateResponse(
        request=request,
        name="products.html",
        context={"products": products},
    )


@app.post("/products")
async def create_product_ui(request: Request, name: str = Form(...), mbr_types: str = Form(...)):
    """Create a new product via form."""
    # mbr_types is expected as a comma-separated string from the form
    types_list = [t.strip() for t in mbr_types.split(",") if t.strip()]
    db.create_product(name, types_list)
    return list_products_ui(request)


@app.get("/products/{product_id}", response_class=HTMLResponse)
def product_detail_ui(request: Request, product_id: str):
    """HTML page showing product details and its batches."""
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    batches = db.list_batches(product_id)
    return templates.TemplateResponse(
        request=request,
        name="product_detail.html",
        context={"product": product, "batches": batches},
    )


@app.get("/products/{product_id}/trending", response_class=HTMLResponse)
def product_trending_ui(request: Request, product_id: str):
    """HTML page showing cross-batch trending for a product."""
    product = db.get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    batches = db.list_batches(product_id)
    return templates.TemplateResponse(
        request=request,
        name="project_trending.html",
        context={"product": product, "batches": batches},
    )


import csv

@app.get("/api/products/{product_id}/parameters")
def get_product_parameters(product_id: str):
    """Get a list of unique parameter labels extracted for a product."""
    documents = db.list_documents(product_id=product_id)
    completed_docs = [d for d in documents if d["status"] == "completed"]
    
    unique_params = set()
    for doc in completed_docs:
        csv_path = doc_export_path(doc["id"])
        if not csv_path.exists():
            try:
                export_csv(doc["id"])
            except Exception:
                continue
        if csv_path.exists():
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    label = row.get("parameter_label")
                    if label and label != "—" and label.strip():
                        unique_params.add(label.strip())
                        
    return {"parameters": sorted(list(unique_params))}


@app.get("/api/products/{product_id}/trending_data")
def get_trending_data(product_id: str, batch_ids: str, parameters: str):
    """Get actual values for specific parameters across selected batches."""
    b_ids = [b.strip() for b in batch_ids.split(",") if b.strip()]
    p_labels = [p.strip() for p in parameters.split(",") if p.strip()]
    
    documents = db.list_documents(product_id=product_id)
    # Target complete docs belonging to selected batches
    target_docs = [d for d in documents if d.get("batch_id") in b_ids and d["status"] == "completed"]
    # Sort docs chronologically to ensure time-series holds
    target_docs.sort(key=lambda d: d["created_at"])
    
    results = {b_id: [] for b_id in b_ids}
    
    for doc in target_docs:
        batch_id = doc["batch_id"]
        csv_path = doc_export_path(doc["id"])
        if not csv_path.exists():
            try:
                export_csv(doc["id"])
            except Exception:
                continue
                
        if csv_path.exists():
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    label = row.get("parameter_label", "").strip()
                    if label in p_labels:
                        actual = row.get("actual_value", "").strip()
                        if actual and actual != "—":
                            results[batch_id].append({
                                "parameter": label,
                                "value": actual,
                                "units": row.get("units", ""),
                                "document": doc["original_filename"],
                                "created_at": doc["created_at"]
                            })
                        
    return {"data": results}


@app.post("/products/{product_id}/batches")
async def create_batch_ui(request: Request, product_id: str, lot_number: str = Form(...)):
    """Create a new batch for a product."""
    db.create_batch(product_id, lot_number)
    return product_detail_ui(request, product_id)


@app.get("/batches/{batch_id}", response_class=HTMLResponse)
def batch_detail_ui(request: Request, batch_id: str):
    """HTML page showing batch details and its documents."""
    batch = db.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    product = db.get_product(batch["product_id"])
    documents = db.list_documents(batch_id=batch_id)
    
    # Group documents by mbr_type for better visualization
    grouped_docs = {}
    if product:
        for t in product["mbr_types"]:
            grouped_docs[t] = [d for d in documents if d.get("mbr_type") == t]
    
    # Also capture docs that don't match or have no type
    other_docs = [d for d in documents if d.get("mbr_type") not in (product["mbr_types"] if product else [])]
    if other_docs:
        grouped_docs["Other/Uncategorized"] = other_docs

    return templates.TemplateResponse(
        request=request,
        name="batch_detail.html",
        context={
            "batch": batch, 
            "product": product, 
            "grouped_documents": grouped_docs,
        },
    )
