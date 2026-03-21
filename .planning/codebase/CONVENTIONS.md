# Code Conventions

## General Style

| Convention | Detail |
|-----------|--------|
| Python version | 3.10+ (uses `str \| Path` union syntax) |
| Formatting | Consistent 4-space indentation, ~100 char line width |
| Imports | Standard library → third-party → local app, grouped by blank lines |
| Docstrings | Module-level + function-level, triple-quote, brief descriptions |
| Type hints | Used on all function signatures (params + return types) |
| Comments | Section headers with `# ── Section Name ────…` box-drawing pattern |

---

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
  1. Pydantic `@model_validator(mode="after")` on `ExtractedRow` for auto-flagging
  2. Business-rule checks in `validator.py` that collect non-fatal warnings
- `ValidationResult.valid` is `True` even with warnings (only `False` on parse/schema errors)

---

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

---

## Template / Frontend Patterns

- Jinja2 template inheritance: `{% extends "base.html" %}` with `{% block content %}` / `{% block scripts %}`
- CSS: Custom properties (CSS variables) for design tokens in `:root`
- Dark mode only (no light mode toggle)
- Client-side JS: Vanilla JavaScript, no framework
- Data fetching via `fetch()` to JSON API endpoints
- Google Fonts loaded via `@import url(…)` in `<style>` tag

---

## Comments Style

Distinctive section-heading pattern used throughout:

```python
# ── Section Name ──────────────────────────────────────────────
```

This is used to separate logical sections within modules (e.g., "Prompts", "Client", "Document CRUD", "Page CRUD").
