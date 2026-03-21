# External Integrations

## Google Gemini API

| Aspect | Detail |
|--------|--------|
| SDK | `google-genai` (≥ 1.0.0) |
| Auth | API key via `GEMINI_API_KEY` env var |
| Model | `gemini-2.0-flash` (configurable via `GEMINI_MODEL`) |
| Type | Multimodal (image + text → structured JSON) |
| Key file | `app/gemini_client.py` |

### Usage Pattern

```python
client = genai.Client(api_key=settings.gemini_api_key)
response = client.models.generate_content(
    model=settings.gemini_model,
    contents=[types.Content(role="user", parts=[image_part, text_part])],
    config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=8192),
)
```

### Request Flow
1. Page image bytes loaded from disk
2. Sent as `types.Part.from_bytes(data=image_bytes, mime_type="image/png")`
3. Accompanied by structured extraction prompt (system + user)
4. Response parsed as JSON, markdown fences stripped if present
5. JSON sanity-checked via `json.loads()` before returning

### Retry Logic
- Max attempts: `MAX_RETRIES` (default 3)
- Exponential backoff: `RETRY_BASE_DELAY * 2^(attempt-1)` seconds
- Retries on: `json.JSONDecodeError` (invalid response) and generic exceptions (API errors)
- Raises `RuntimeError` after all retries exhausted

### Prompt Structure
- **System prompt:** Expert MBR document extraction instructions, one-parameter-per-row rules
- **User prompt:** Page-specific template with schema definition, examples, and extraction rules
- Both prompts enforce strict JSON-only output (no markdown/commentary)

---

## SQLite Database

| Aspect | Detail |
|--------|--------|
| Library | `sqlite3` (stdlib) |
| Path | `data/mbr_extractor.db` (configurable via `DB_PATH`) |
| Key file | `app/db.py` |

### Schema
- **`documents` table:** `id` (TEXT PK), `original_filename`, `total_pages`, `status`, `created_at`, `updated_at`, `error_message`
- **`pages` table:** Auto-increment PK, `document_id` (FK), `page_number`, `status`, `image_path`, `raw_json_path`, `normalized_json_path`, `error_message`, timestamps
- **Status enums:** documents: `uploaded → processing → completed/failed`; pages: `pending → processing → completed/failed`

### Connection Pattern
- New connection per operation via `_get_conn()` (no pooling)
- `row_factory = sqlite3.Row` for dict-like access
- `PRAGMA journal_mode=WAL` for concurrent reads
- `PRAGMA foreign_keys=ON` for referential integrity

---

## Local Filesystem (Data Store)

The application uses the local filesystem as its primary data store for all artifacts:

| Type | Path Pattern | Format |
|------|-------------|--------|
| Uploaded PDFs | `data/uploads/<doc_id>.pdf` | PDF |
| Rendered pages | `data/images/<doc_id>/page_NNNN.png` | PNG |
| Raw Gemini output | `data/raw_json/<doc_id>/page_NNNN_raw.json` | JSON |
| Normalized data | `data/normalized_json/<doc_id>/page_NNNN_normalized.json` | JSON |
| CSV exports | `data/exports/<doc_id>.csv` | CSV |

All paths are derived via utility functions in `app/utils.py` using `settings.data_root` as the base.

---

## No Other External Integrations

The application currently has **no**:
- External databases (PostgreSQL, Redis, etc.)
- Cloud storage (S3, GCS)
- Authentication providers (OAuth, JWT)
- Message queues (Celery, RabbitMQ)
- Webhook endpoints (inbound or outbound)
- CDN or external asset hosting
- Monitoring/logging services (Sentry, Datadog)
- CI/CD integrations
