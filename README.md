# MBR Extractor

**Extract structured data from scanned Master Batch Record (MBR) PDFs using Gemini multimodal AI.**

This MVP tool is designed for MSAT data analysis — it renders PDF pages as high-resolution images, sends each to Google Gemini for structured extraction, validates results with Pydantic, and provides a lightweight review UI for flagged or failed pages.

---

## Architecture

```
┌────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│  Upload PDF │──►  │ pdf_renderer │──►  │gemini_client│──►  │ validator  │
│  (FastAPI)  │     │  (PyMuPDF)   │     │ (Gemini AI) │     │ (Pydantic) │
└────────────┘     └──────────────┘     └─────────────┘     └────────────┘
                                                                   │
                                              ┌────────────────────┼────────────────┐
                                              ▼                    ▼                ▼
                                        ┌──────────┐      ┌──────────────┐  ┌────────────┐
                                        │ raw JSON │      │ normalized   │  │  SQLite DB │
                                        │ (per page)│      │ JSON (valid) │  │ (metadata) │
                                        └──────────┘      └──────────────┘  └────────────┘
                                                                   │
                                                                   ▼
                                                            ┌────────────┐
                                                            │  CSV export │
                                                            │  (flattened)│
                                                            └────────────┘
```

**Flow:**
1. User uploads a PDF via API or web UI.
2. Each page is rendered to high-res PNG using PyMuPDF.
3. Each page image is sent to Gemini with a structured extraction prompt.
4. The raw Gemini response is saved, then validated via Pydantic.
5. Valid pages produce normalized JSON; invalid pages are marked failed.
6. All results are exported to a flattened CSV for MSAT analysis.
7. A review UI shows pages, extracted rows, errors, and flagged entries.

---

## Setup

### Prerequisites
- Python 3.10+
- A Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Install

```bash
cd /home/h4harsimran/hcrtool
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configure

```bash
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(required)* | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model name |
| `RENDER_DPI` | `300` | DPI for PDF → PNG rendering |
| `MAX_RETRIES` | `3` | Gemini API retry attempts |
| `RETRY_BASE_DELAY` | `2.0` | Base delay (seconds) for exponential backoff |
| `DATA_DIR` | `data` | Root data directory |
| `DB_PATH` | `data/mbr_extractor.db` | SQLite database path |

---

## Running

### Start the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Open the review UI

Navigate to [http://localhost:8000/review](http://localhost:8000/review)

### Interactive API docs

Navigate to [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Usage

### Upload a PDF

```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@/path/to/batch_record.pdf"
```

Response:
```json
{
  "document_id": "a1b2c3d4e5f6",
  "filename": "batch_record.pdf",
  "message": "PDF uploaded successfully. POST /process/{document_id} to start extraction."
}
```

### Process a document

```bash
curl -X POST http://localhost:8000/process/a1b2c3d4e5f6
```

### List documents

```bash
curl http://localhost:8000/documents
```

### Get document details

```bash
curl http://localhost:8000/documents/a1b2c3d4e5f6
```

### Get pages

```bash
curl http://localhost:8000/documents/a1b2c3d4e5f6/pages
```

### Download CSV

```bash
curl -o output.csv http://localhost:8000/documents/a1b2c3d4e5f6/export/csv
```

### Get raw Gemini responses

```bash
curl http://localhost:8000/documents/a1b2c3d4e5f6/raw
```

### Get normalized JSON

```bash
curl http://localhost:8000/documents/a1b2c3d4e5f6/normalized
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Upload a PDF batch record |
| `POST` | `/process/{document_id}` | Trigger extraction pipeline |
| `GET` | `/documents` | List all documents |
| `GET` | `/documents/{document_id}` | Document detail + status |
| `GET` | `/documents/{document_id}/pages` | Page list with statuses |
| `GET` | `/documents/{document_id}/export/csv` | Download flattened CSV |
| `GET` | `/documents/{document_id}/raw` | Raw Gemini JSON responses |
| `GET` | `/documents/{document_id}/normalized` | Validated normalized JSON |
| `GET` | `/review` | Web review dashboard |
| `GET` | `/review/{document_id}` | Per-document review page |

---

## Output Locations

| Type | Location |
|------|----------|
| Uploaded PDFs | `data/uploads/` |
| Page images (PNG) | `data/images/<doc_id>/` |
| Raw Gemini JSON | `data/raw_json/<doc_id>/` |
| Normalized JSON | `data/normalized_json/<doc_id>/` |
| Exported CSVs | `data/exports/` |
| SQLite database | `data/mbr_extractor.db` |

---

## Running Tests

```bash
python -m pytest tests/ -v
```

Tests cover:
- Pydantic schema validation (field constraints, auto-flagging)
- CSV export logic (column headers, row counts, field mapping)

---

## Project Structure

```
hcrtool/
├── app/
│   ├── __init__.py
│   ├── config.py          # Settings from .env
│   ├── db.py              # SQLite CRUD
│   ├── models.py          # Internal dataclasses
│   ├── schemas.py         # Pydantic v2 models
│   ├── utils.py           # Helpers
│   ├── pdf_renderer.py    # PDF → PNG
│   ├── gemini_client.py   # Gemini multimodal
│   ├── validator.py       # Response validation
│   ├── extractor.py       # Pipeline orchestrator
│   ├── exporter.py        # CSV export
│   ├── main.py            # FastAPI app
│   └── templates/
│       ├── base.html
│       ├── review_dashboard.html
│       └── review_document.html
├── data/
│   ├── uploads/
│   ├── images/
│   ├── raw_json/
│   ├── normalized_json/
│   └── exports/
├── tests/
│   ├── __init__.py
│   ├── test_schemas.py
│   └── test_exporter.py
├── .env.example
├── requirements.txt
└── README.md
```

---

## Known Limitations

- **Synchronous processing**: Documents are processed inline on the `/process` endpoint. Large PDFs may timeout for HTTP clients — use a longer timeout or process asynchronously in the future.
- **No authentication**: The MVP has no user auth — suitable for local / internal use only.
- **No editing in review UI**: The review screen is read-only. Manual corrections require editing the normalized JSON files directly.
- **Single-model extraction**: Uses one prompt for all page types. Pages with unusual layouts may need prompt tuning.
- **No pagination**: API list endpoints return all results. Add pagination for large-scale use.

---

## Next-Step Enhancements

1. **Async processing** — Use background tasks (Celery / FastAPI BackgroundTasks) for large PDFs.
2. **Editable review UI** — Allow inline corrections that update the normalized JSON.
3. **Prompt versioning** — Track prompt versions alongside results for reproducibility.
4. **Confidence thresholds** — Auto-accept pages above a configurable confidence score.
5. **Multi-document comparison** — Compare extraction results across batches.
6. **Cloud storage** — Swap local filesystem for S3/GCS.
7. **Export formats** — Add Excel and Parquet export options.
8. **Webhook notifications** — Notify when processing completes.
