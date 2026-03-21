<!-- GSD:project-start source:PROJECT.md -->
## Project

**MBR Extractor**

A batch analytics platform for MSAT teams that extracts structured data from scanned Master Batch Record (MBR) PDFs using Gemini multimodal AI, then enables cross-batch trending and comparison of critical process parameters like cell counts, viability, and confluency. Built for non-technical users who need to upload MBRs, visualize batch health, and compare performance across production runs — without downloading CSVs into Excel.

**Core Value:** Users can visualize how critical process parameters (cell count, viability, confluency) trend across days within a batch and compare trends across multiple batches of the same product — turning scattered PDF data into actionable manufacturing insights.

### Constraints

- **Budget**: Free-tier hosting only (Render, free DB) — Gemini API key is the only paid resource
- **Tech stack**: Python/FastAPI backend (existing), can add JS frontend framework for premium UI
- **Image storage**: Browser-side storage (IndexedDB/localStorage) to avoid server storage costs
- **Auth**: Free-tier auth provider (Supabase free, Clerk free, or similar)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Language & Runtime
| Item | Detail |
|------|--------|
| Language | Python 3.10+ |
| Package manager | pip / `requirements.txt` |
| Virtual environment | `.venv` (manual, no Poetry/Pipenv) |
| Type hints | Used throughout (PEP 604 union syntax `str | Path`) |
## Core Frameworks
### FastAPI (≥ 0.110.0)
- **Role:** HTTP API + server-rendered HTML review UI
- **Entry point:** `app/main.py` → `app = FastAPI(…)`
- **Run command:** `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- **Key patterns:**
### Pydantic v2 (≥ 2.6.0) + pydantic-settings (≥ 2.1.0)
- **Role:** Request/response validation, data schemas, configuration
- **Key files:**
- **Notable:** `@model_validator(mode="after")` for auto-flagging rows needing review
### Uvicorn (≥ 0.27.0)
- ASGI server with `[standard]` extras (watchfiles, httptools, uvloop)
## AI / ML Dependencies
### google-genai (≥ 1.0.0)
- **Role:** Gemini multimodal API client for page image → structured JSON extraction
- **Key file:** `app/gemini_client.py`
- **Model used:** Configurable via `GEMINI_MODEL` env var (default: `gemini-2.0-flash`)
- **Pattern:** `genai.Client(api_key=…)` → `client.models.generate_content(…)` with `types.Content`, `types.Part`
- **Config:** `temperature=0.1`, `max_output_tokens=8192`
## Document Processing
### PyMuPDF / fitz (≥ 1.24.0)
- **Role:** PDF page → high-resolution PNG rendering
- **Key file:** `app/pdf_renderer.py`
- **Pattern:** `fitz.open()` → `page.get_pixmap(matrix=…)` → `.save()`
- **DPI:** Configurable via `RENDER_DPI` (default 300, zoom = DPI/72)
## Data Storage
### SQLite (stdlib `sqlite3`)
- **Role:** Document/page metadata and status tracking
- **Key file:** `app/db.py`
- **Database path:** `data/mbr_extractor.db` (configurable)
- **Tables:** `documents`, `pages`
- **Pragmas:** `journal_mode=WAL`, `foreign_keys=ON`
- **Pattern:** Per-call `_get_conn()` (no connection pooling)
### Filesystem
- Raw Gemini JSON: `data/raw_json/<doc_id>/page_NNNN_raw.json`
- Normalized JSON: `data/normalized_json/<doc_id>/page_NNNN_normalized.json`
- Rendered images: `data/images/<doc_id>/page_NNNN.png`
- CSV exports: `data/exports/<doc_id>.csv`
- Uploaded PDFs: `data/uploads/<doc_id>.pdf`
## Templating & Frontend
### Jinja2 (≥ 3.1.0)
- Server-side HTML rendering for review UI
- 4 templates: `base.html`, `review_dashboard.html`, `review_document.html`, `data_viewer.html`
### Vanilla CSS + JavaScript
- Dark-mode design system with CSS custom properties in `base.html`
- Google Fonts: Inter, JetBrains Mono
- `data_viewer.html` has client-side JS for column toggles, search, filtering, sorting
- Fetches data via `/documents/{id}/normalized` JSON API
## Other Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| python-multipart | ≥ 0.0.9 | File upload parsing for FastAPI |
| python-dotenv | ≥ 1.0.0 | `.env` file loading |
| aiofiles | ≥ 23.2.0 | Async file operations (for static file serving) |
| pytest | ≥ 8.0.0 | Test framework |
## Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(required)* | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `RENDER_DPI` | `300` | PDF → PNG rendering DPI |
| `MAX_RETRIES` | `3` | Gemini API retry attempts |
| `RETRY_BASE_DELAY` | `2.0` | Exponential backoff base (seconds) |
| `DATA_DIR` | `data` | Root data directory |
| `DB_PATH` | `data/mbr_extractor.db` | SQLite database path |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## General Style
| Convention | Detail |
|-----------|--------|
| Python version | 3.10+ (uses `str \| Path` union syntax) |
| Formatting | Consistent 4-space indentation, ~100 char line width |
| Imports | Standard library → third-party → local app, grouped by blank lines |
| Docstrings | Module-level + function-level, triple-quote, brief descriptions |
| Type hints | Used on all function signatures (params + return types) |
| Comments | Section headers with `# ── Section Name ────…` box-drawing pattern |
## Code Patterns
### Configuration
- Single `Settings(BaseSettings)` class in `app/config.py`
- `.env` loading via pydantic-settings
- Module-level singleton: `settings = Settings()`
- Derived paths via `@property` methods
### Database Access
- Per-call connections via `_get_conn()` → `sqlite3.connect()`
- `with conn:` context manager for automatic commit/rollback
- `conn.row_factory = sqlite3.Row` for dict-like row access
- Functions return `dict` (via `dict(row)`) or `list[dict]`
- Dynamic SQL via f-string for `UPDATE` sets (in `update_document`, `update_page`)
### Error Handling
- **Gemini client:** Retry with exponential backoff, catch JSON parse errors and API errors separately
- **Pipeline:** Per-page try/except — individual page failures don't stop document processing
- **API routes:** FastAPI `HTTPException` for 400/404/409/500 responses
- **Logging:** `logging.getLogger(__name__)` per module, `logger.info/warning/exception`
### Data Flow Pattern
- Raw text → `json.loads()` → Pydantic `model_validate()` → `model_dump(mode="json")` → file write
- All file I/O through `app/utils.py` helpers (`save_json`, `load_json`, `ensure_dir`)
- Path building via utility functions: `page_image_path()`, `page_raw_json_path()`, etc.
### Validation Pattern
- Two-layer validation:
- `ValidationResult.valid` is `True` even with warnings (only `False` on parse/schema errors)
## Naming Conventions
| Context | Convention | Examples |
|---------|-----------|---------|
| Files | `snake_case.py` | `gemini_client.py`, `pdf_renderer.py` |
| Classes | `PascalCase` | `ExtractedRow`, `PageExtraction`, `Settings` |
| Functions | `snake_case` | `process_document()`, `render_pdf()` |
| Constants | `UPPER_SNAKE` | `CSV_COLUMNS`, `SYSTEM_PROMPT` |
| Private | `_prefix` | `_SCHEMA`, `_get_conn()`, `_now()`, `_build_client()` |
| DB fields | `snake_case` | `document_id`, `page_number`, `raw_json_path` |
| Templates | `snake_case.html` | `review_dashboard.html` |
## Template / Frontend Patterns
- Jinja2 template inheritance: `{% extends "base.html" %}` with `{% block content %}` / `{% block scripts %}`
- CSS: Custom properties (CSS variables) for design tokens in `:root`
- Dark mode only (no light mode toggle)
- Client-side JS: Vanilla JavaScript, no framework
- Data fetching via `fetch()` to JSON API endpoints
- Google Fonts loaded via `@import url(…)` in `<style>` tag
## Comments Style
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern: Modular Pipeline with REST API Frontend
## High-Level Data Flow
```
```
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
## Key Abstractions
### Document Lifecycle
```
```
- Each document has a unique 12-char hex ID (`uuid4.hex[:12]`)
- Status tracked in SQLite `documents` table
- Pages have independent status: `pending → processing → completed | failed`
### Extraction Data Model
```
```
### Auto-Flagging Logic
- `needs_review=true` if: `actual_value` is null, `performed_by_initials` is null, or `verified_by_initials` is null
- Implemented as `@model_validator(mode="after")` on `ExtractedRow` + additional checks in `validator.py`
## Entry Points
| Entry point | File | Command |
|------------|------|---------|
| Web server | `app/main.py` | `uvicorn app.main:app --reload` |
| Tests | `tests/` | `python -m pytest tests/ -v` |
## Processing Model
- **Synchronous:** Document processing runs inline on the `/process/{document_id}` endpoint
- **Sequential per page:** Pages processed one at a time in a for-loop
- **No background workers:** No Celery, no `BackgroundTasks`
- **Partial failure:** Individual page failures don't stop processing; document marked `failed` if any page fails
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
