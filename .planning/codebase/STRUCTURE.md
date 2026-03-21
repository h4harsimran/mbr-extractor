# Directory Structure

## Project Root

```
hcrtool/
├── app/                          # Application source code
│   ├── __init__.py               # Package init (empty)
│   ├── config.py                 # Settings from .env (pydantic-settings)
│   ├── db.py                     # SQLite CRUD helpers
│   ├── models.py                 # Internal dataclasses (PageImage, ProcessingResult)
│   ├── schemas.py                # Pydantic v2 models (extraction + API response)
│   ├── utils.py                  # Shared helpers (ID gen, path builders, JSON I/O)
│   ├── pdf_renderer.py           # PDF → PNG rendering (PyMuPDF)
│   ├── gemini_client.py          # Gemini AI multimodal extraction client
│   ├── validator.py              # Pydantic validation + business rule flagging
│   ├── extractor.py              # Pipeline orchestrator (process_document)
│   ├── exporter.py               # CSV export from normalized JSON
│   ├── main.py                   # FastAPI app, routes, startup
│   └── templates/                # Jinja2 HTML templates
│       ├── base.html             # Shared layout (dark-mode CSS design system)
│       ├── review_dashboard.html # Document listing + upload form
│       ├── review_document.html  # Per-document page review
│       └── data_viewer.html      # Interactive data table (JS filtering/sorting)
├── data/                         # Runtime data (gitignored?)
│   ├── uploads/                  # Uploaded PDF files
│   ├── images/                   # Rendered PNG pages (per doc_id)
│   ├── raw_json/                 # Raw Gemini JSON responses (per doc_id)
│   ├── normalized_json/          # Validated/normalized JSON (per doc_id)
│   ├── exports/                  # Generated CSV exports
│   └── mbr_extractor.db          # SQLite database
├── tests/                        # Test suite
│   ├── __init__.py               # Package init
│   ├── test_schemas.py           # ExtractedRow + PageExtraction validation tests
│   └── test_exporter.py          # CSV export logic tests
├── .agent/                       # GSD agent configuration
├── .env                          # Environment variables (not committed)
├── .env.example                  # Environment template
├── requirements.txt              # Python dependencies
└── README.md                     # Project documentation
```

---

## Key Locations

| What | Path |
|------|------|
| FastAPI app factory | `app/main.py` line 34 |
| All routes | `app/main.py` |
| Core pipeline | `app/extractor.py` → `process_document()` |
| Gemini prompts | `app/gemini_client.py` lines 18–92 |
| Database schema | `app/db.py` lines 12–35 |
| Pydantic models | `app/schemas.py` |
| Configuration | `app/config.py` |
| CSS design system | `app/templates/base.html` lines 7–241 |
| Data viewer JS | `app/templates/data_viewer.html` lines 137–349 |

---

## Naming Conventions

| Convention | Example |
|-----------|---------|
| Module files | `snake_case.py` (`gemini_client.py`, `pdf_renderer.py`) |
| Classes | `PascalCase` (`ExtractedRow`, `PageExtraction`, `Settings`) |
| Functions | `snake_case` (`process_document`, `render_pdf`, `extract_page`) |
| Constants | `UPPER_SNAKE` (`CSV_COLUMNS`, `SYSTEM_PROMPT`, `_SCHEMA`) |
| Template files | `snake_case.html` (`review_dashboard.html`, `data_viewer.html`) |
| Data files | `page_NNNN_raw.json`, `page_NNNN_normalized.json`, `page_NNNN.png` |
| Document IDs | 12-char hex strings from `uuid4.hex[:12]` |

---

## File Size Distribution

| File | Lines | Bytes | Complexity |
|------|-------|-------|-----------|
| `main.py` | 308 | 11,495 | Highest — all routes + review UI logic |
| `gemini_client.py` | 177 | 7,264 | Prompts take ~75 lines |
| `extractor.py` | 142 | 5,263 | Pipeline orchestration |
| `db.py` | 125 | 4,362 | SQL schema + CRUD |
| `schemas.py` | 104 | 3,965 | Data models |
| `validator.py` | 81 | 2,518 | Validation logic |
| `exporter.py` | 70 | 1,807 | CSV export |
| `utils.py` | 62 | 1,796 | Helpers |
| `config.py` | 63 | 1,559 | Settings |
| `pdf_renderer.py` | 40 | 1,153 | PDF rendering |
| `models.py` | 26 | 546 | Dataclasses |

Templates: `base.html` (264 lines), `data_viewer.html` (351 lines), `review_document.html` (6,420 bytes), `review_dashboard.html` (3,972 bytes)
