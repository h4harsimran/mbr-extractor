# Concerns

## Critical

### 1. Synchronous Processing — Request Timeout Risk
- **Location:** `app/extractor.py` → `process_document()`, called inline from `app/main.py` `/process/{document_id}`
- **Issue:** Processing runs synchronously on the HTTP request thread. For a 50-page PDF, each page requires Gemini API call (~3–10s). Total: 2.5–8+ minutes per document.
- **Impact:** HTTP clients will timeout. `uvicorn` may kill the worker.
- **Recommendation:** Use FastAPI `BackgroundTasks` or Celery for async processing. Add SSE/polling for status.

### 2. No Authentication or Authorization
- **Location:** `app/main.py` — all routes are public
- **Issue:** Anyone with network access can upload PDFs, trigger processing, and download data.
- **Impact:** Suitable only for local/internal use. Exposes AI costs (Gemini API key usage).
- **Recommendation:** Add API key auth or session-based auth before any non-local deployment.

### 3. SQL Injection via f-string
- **Location:** `app/db.py` lines 84–87 (`update_document`) and 121–123 (`update_page`)
- **Issue:** Column names in `UPDATE` statements are built via f-string from `**kwargs` keys. While not directly user-controlled, this pattern is fragile.
- **Code:**
  ```python
  sets = ", ".join(f"{k} = ?" for k in kwargs)  # column names via f-string
  ```
- **Impact:** Low risk currently (callers pass hardcoded keys), but could become a vulnerability if kwargs come from user input in the future.
- **Recommendation:** Whitelist allowed column names in the update functions.

---

## High

### 4. No Connection Pooling
- **Location:** `app/db.py` → `_get_conn()`
- **Issue:** Each database operation creates a new `sqlite3.Connection`. No reuse, no pooling.
- **Impact:** Performance overhead on high-volume usage. Not critical for MVP scale but will matter if concurrent users increase.

### 5. API Key Exposed in Environment
- **Location:** `app/config.py` — `gemini_api_key` loaded from `.env`
- **Issue:** No secret management. API key stored in plaintext `.env` file.
- **Missing:** No `.gitignore` found in project root (potential accidental commit risk for `.env`).

### 6. No Rate Limiting
- **Location:** `app/main.py` — all endpoints
- **Issue:** No rate limiting on upload or processing endpoints. A bad actor could exhaust Gemini API credits.

---

## Medium

### 7. No Input Validation on PDF Upload
- **Location:** `app/main.py` → `upload_pdf()` (lines 64–84)
- **Issue:** Only checks file extension (`.pdf`). No file size limit, no MIME type validation, no virus scanning.
- **Impact:** Large files could exhaust disk/memory. Non-PDF files with `.pdf` extension would be accepted.

### 8. Hardcoded Absolute Paths in Database
- **Location:** `app/extractor.py` — stores full absolute paths in `image_path`, `raw_json_path`, `normalized_json_path` columns
- **Issue:** Database contains absolute filesystem paths. Moving the project breaks all path references.
- **Recommendation:** Store relative paths from `settings.data_root`.

### 9. No Pagination on List Endpoints
- **Location:** `app/main.py` → `list_documents()`, `get_pages()`, raw/normalized JSON endpoints
- **Issue:** All results returned in a single response. Will degrade with many documents.

### 10. Missing `.gitignore`
- **Issue:** No `.gitignore` found. Risk of committing `.env`, `data/`, `__pycache__/`, `.venv/` to version control.

---

## Low / Technical Debt

### 11. Deprecated `@app.on_event("startup")`
- **Location:** `app/main.py` line 47
- **Issue:** `on_event` is deprecated in newer FastAPI versions. Should use `lifespan` context manager.

### 12. No Logging Configuration Beyond BasicConfig
- **Location:** `app/main.py` lines 27–30
- **Issue:** `logging.basicConfig()` with no log file rotation, no structured logging.

### 13. Redundant Validation
- **Location:** Auto-flagging runs in both `schemas.py` (`@model_validator`) and `validator.py` (lines 60–73)
- **Issue:** `actual_value is None` check appears in both places. The validator re-checks what the model validator already handles.

### 14. No Export Format Flexibility
- **Location:** `app/exporter.py` — CSV only
- **Noted in README:** Excel and Parquet export listed as future enhancements.

### 15. Test Coverage Low (~15%)
- Only `schemas.py` and `exporter.py` have tests
- No API route tests, no integration tests, no Gemini mock tests
- See `TESTING.md` for detailed coverage gaps
