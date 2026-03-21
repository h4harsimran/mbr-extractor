# Architecture

## Pattern: Modular Pipeline with REST API Frontend

The application follows a **pipeline architecture** — a PDF document flows through discrete processing stages, each handled by a dedicated module. The FastAPI layer exposes the pipeline via HTTP and renders a review UI.

---

## High-Level Data Flow

```
User Upload (PDF)
      │
      ▼
┌─────────────────┐
│  pdf_renderer    │  PDF → high-res PNG per page (PyMuPDF)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  gemini_client   │  PNG image → structured JSON (Gemini AI multimodal)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  validator       │  Raw JSON → Pydantic validation + business-rule flagging
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  exporter        │  Normalized JSON → flattened CSV
└────────┬────────┘
         │
         ▼
  Review UI / API
```

---

## Layers

### 1. API Layer (`app/main.py`)
- **FastAPI application** with REST endpoints + HTML server-rendered pages
- Routes: upload, process, list/detail, raw JSON, normalized JSON, CSV export, review UI, data viewer
- Entry point: `uvicorn app.main:app`
- Handles HTTP concerns (file upload, error responses, template rendering)
- No business logic — delegates to pipeline modules

### 2. Pipeline Orchestration (`app/extractor.py`)
- `process_document(doc_id)` — the core pipeline function
- Coordinates: render → extract → validate → persist → export
- Manages document/page status transitions in SQLite
- Handles errors per page (partial failure allowed)
- Returns `list[ProcessingResult]` with per-page outcomes

### 3. Processing Modules
- `app/pdf_renderer.py` — PDF → PNG rendering (PyMuPDF)
- `app/gemini_client.py` — Image → JSON extraction (Gemini API)
- `app/validator.py` — JSON → validated Pydantic models

### 4. Data Layer
- `app/db.py` — SQLite CRUD (document/page metadata)
- `app/utils.py` — File I/O helpers, path builders, JSON serialization
- `app/exporter.py` — Normalized JSON → CSV

### 5. Schema Layer
- `app/schemas.py` — Pydantic v2 models (extraction data, API responses)
- `app/models.py` — Internal dataclasses (`PageImage`, `ProcessingResult`)

### 6. Presentation Layer
- `app/templates/base.html` — Shared layout with dark-mode CSS design system
- `app/templates/review_dashboard.html` — Document list + upload form
- `app/templates/review_document.html` — Per-document page-by-page review
- `app/templates/data_viewer.html` — Interactive data table with filters/sorts

---

## Key Abstractions

### Document Lifecycle
```
uploaded → processing → completed | failed
```
- Each document has a unique 12-char hex ID (`uuid4.hex[:12]`)
- Status tracked in SQLite `documents` table
- Pages have independent status: `pending → processing → completed | failed`

### Extraction Data Model
```
DocumentMetadata
  └─ PageExtraction (1 per page)
       └─ ExtractedRow[] (N rows per page)
            ├─ parameter_label, target_value, actual_value, units
            ├─ performed_by, verified_by (initials + dates)
            ├─ extraction_confidence (0.0–1.0)
            ├─ needs_review (auto-flagged)
            └─ reviewer_notes
```

### Auto-Flagging Logic
- `needs_review=true` if: `actual_value` is null, `performed_by_initials` is null, or `verified_by_initials` is null
- Implemented as `@model_validator(mode="after")` on `ExtractedRow` + additional checks in `validator.py`

---

## Entry Points

| Entry point | File | Command |
|------------|------|---------|
| Web server | `app/main.py` | `uvicorn app.main:app --reload` |
| Tests | `tests/` | `python -m pytest tests/ -v` |

---

## Processing Model

- **Synchronous:** Document processing runs inline on the `/process/{document_id}` endpoint
- **Sequential per page:** Pages processed one at a time in a for-loop
- **No background workers:** No Celery, no `BackgroundTasks`
- **Partial failure:** Individual page failures don't stop processing; document marked `failed` if any page fails
