# MBR Extractor

<p align="center"><strong>Lightweight AI-assisted structured data extraction for Master Batch Record PDFs.</strong></p>

MBR Extractor renders PDF pages in the browser, sends page images to a Cloudflare Worker, calls Gemini for structured extraction, validates and normalizes the model response, and lets a human review/edit rows before CSV export.

> **Important:** MBRs are sensitive records. The app does not intentionally store uploaded PDFs or extracted rows server-side, but rendered page images are sent to Gemini during extraction. This is **not** a validated GMP system.

## Features

- Browser-side PDF rendering with `pdf.js`
- Upload preflight with file size, page count, estimated API calls, and privacy notice
- Conservative extraction concurrency and page/file limits to protect API cost
- Cloudflare Worker request validation before Gemini calls
- Hardened API error shape without raw provider/model output in production
- Strict Zod model validation, normalization, structured warnings, and human review flags
- Editable results table, failed-page retry, partial-export confirmation, and CSV export summary
- CSV formula-injection protection
- Security headers for Worker and Cloudflare Pages static assets
- npm root orchestration, tests, and CI

## Documentation

- [Product scope](docs/product-scope.md)
- [Production checklist](docs/production-checklist.md)
- [Sample data policy](docs/sample-data-policy.md)
- [Security policy](SECURITY.md)
- [Contributing guide](CONTRIBUTING.md)
- [MIT License](LICENSE)

## Architecture

```text
Frontend: React + Vite + TypeScript       Worker: Hono on Cloudflare Workers
PDF upload and pdf.js rendering     ───▶  POST /api/extract-page
Review/edit extracted rows          ◀───  Gemini call + Zod validation
CSV export in browser                     No app database/auth/storage
```

## Local development

```bash
npm run install:all
cp .env.example worker/.dev.vars
# edit worker/.dev.vars and set GEMINI_API_KEY for local-only testing
npm run dev:worker
npm run dev:frontend
```

Root scripts:

| Command | Purpose |
| --- | --- |
| `npm run install:all` | Install frontend and worker dependencies. |
| `npm run dev:frontend` | Start the Vite frontend. |
| `npm run dev:worker` | Start the Worker with Wrangler. |
| `npm run build` | Build the frontend. |
| `npm run typecheck` | Typecheck frontend and worker. |
| `npm run test` | Run frontend and worker tests. |

## Configuration

Frontend:

- `VITE_API_URL` — Worker API base URL, for example `https://<worker-domain>/api`.

Worker:

- `GEMINI_API_KEY` — required secret; never expose it in the frontend.
- `GEMINI_MODEL` — defaults to `gemini-3-flash-preview`.
- `ALLOWED_ORIGINS` — comma-separated exact browser origins allowed by CORS.
- `MAX_REQUEST_BYTES` — maximum JSON request body size.
- `MAX_IMAGE_BASE64_CHARS` — maximum base64 page image length.
- `DEBUG_RAW_MODEL_OUTPUT` — set `false` in production; raw model output is included only when `true`.

## API

### `GET /api/health`

```json
{ "status": "ok", "service": "mbr-extractor-api" }
```

### `POST /api/extract-page`

Request:

```json
{
  "image_base64": "base64-encoded-page-image",
  "page_number": 1,
  "mime_type": "image/jpeg"
}
```

Success:

```json
{
  "success": true,
  "page_extraction": {
    "page_number": 1,
    "lot_number": "LOT-123",
    "rows": [
      {
        "page_number": 1,
        "row_id": "1.1",
        "parameter_label": "Temperature",
        "target_value": "37",
        "actual_value": "37.1",
        "units": "°C",
        "comments": null,
        "performed_by_initials": "AB",
        "performed_date": "2026-01-15",
        "verified_by_initials": "CD",
        "verified_date": "2026-01-15",
        "extraction_confidence": 0.94,
        "needs_review": false,
        "warnings": []
      }
    ],
    "warnings": []
  },
  "errors": []
}
```

Error responses use a sanitized shape and do not expose raw Gemini/provider bodies:

```json
{
  "success": false,
  "page_extraction": null,
  "errors": [{ "code": "INVALID_REQUEST", "message": "invalid request" }]
}
```

Possible error codes include `INVALID_REQUEST`, `PAYLOAD_TOO_LARGE`, `PROVIDER_FAILED`, `INVALID_MODEL_JSON`, and `SERVER_MISCONFIGURED`.

## Extracted CSV Fields

```text
page_number
lot_number
row_id
parameter_label
target_value
actual_value
units
comments
performed_by_initials
performed_date
verified_by_initials
verified_date
extraction_confidence
needs_review
review_reason
edited_by_user
```

CSV values beginning with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed to reduce spreadsheet formula-injection risk.

## Deployment

### Cloudflare Pages

- Root directory: repository root
- Build command: `npm run build --prefix frontend`
- Build output directory: `frontend/dist`
- Environment variable: `VITE_API_URL=https://<worker-domain>/api`

### Cloudflare Worker

```bash
npm run deploy --prefix worker
npx wrangler secret put GEMINI_API_KEY --cwd worker
```

Set production `ALLOWED_ORIGINS` to exact Pages origins. Keep `DEBUG_RAW_MODEL_OUTPUT=false`.

Recommended manual Cloudflare dashboard step: add a WAF/rate-limit rule for `POST /api/extract-page` to limit excessive per-IP requests and protect Gemini spend.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
