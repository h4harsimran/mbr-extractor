# MBR Extractor

<p align="center">
  <strong>AI-assisted structured data extraction for Master Batch Record PDFs.</strong>
</p>

<p align="center">
  <a href="https://mbr-extractor-frontend.pages.dev">Live Demo</a>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-blue">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF">
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020">
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-API-4285F4">
</p>

MBR Extractor converts scanned or image-based Master Batch Record pages into structured reviewable rows and exports the result as CSV. The frontend renders each PDF page in the browser, sends page images to a Cloudflare Worker, validates the Gemini response, and lets the user review or edit extracted values before downloading the final dataset.

## Features

- PDF upload with browser-side page rendering using `pdf.js`
- Page-by-page extraction through a Cloudflare Worker API
- Gemini-powered extraction optimized for manufacturing batch records
- Strict JSON validation with Zod before results are accepted
- Batch lot number extraction from page headers, footers, or metadata regions
- Editable results table for correcting extracted values before export
- Confidence scoring and review flags for ambiguous or incomplete rows
- CSV export with batch lot number, parameters, target values, actual values, units, comments, initials, dates, confidence, and review status
- Parallel page processing with progress tracking
- Local session restore using browser `localStorage`
- No app database and no authentication in the current MVP

## Demo

Live application: <https://mbr-extractor-frontend.pages.dev>

## Architecture

```text
┌───────────────────────────────┐       ┌────────────────────────────────┐
│ Frontend: React + Vite         │       │ Backend: Hono + Workers         │
│ Hosted on Cloudflare Pages     │       │ Hosted on Cloudflare Workers    │
│                               │       │                                │
│ PDF upload                    │       │ POST /api/extract-page          │
│   └─ pdf.js renders pages     │       │   └─ validates request          │
│      at 200 DPI               │       │      └─ calls Gemini API        │
│                               │       │         └─ validates JSON       │
│ Results table                 │◄──────│            with Zod             │
│ CSV export                    │       │                                │
└───────────────────────────────┘       └────────────────────────────────┘
```

### Data flow

1. The user uploads a PDF in the browser.
2. `pdf.js` renders each page to an off-screen canvas.
3. Each rendered page is converted to a base64 image.
4. The frontend sends one page image at a time to `/api/extract-page`.
5. The Worker forwards the image and extraction prompt to Gemini.
6. The Worker validates the returned JSON with Zod.
7. The frontend displays extracted rows for review and correction.
8. The final reviewed data is exported as CSV in the browser.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, TypeScript |
| PDF rendering | `pdfjs-dist` |
| Backend | Hono on Cloudflare Workers |
| Validation | Zod |
| AI extraction | Gemini API |
| Hosting | Cloudflare Pages + Cloudflare Workers |
| Storage | Browser `localStorage` only for session restore |

## Repository Structure

```text
mbr-extractor/
├── frontend/
│   ├── src/
│   │   ├── components/          # Upload, progress, and results UI
│   │   ├── lib/                 # PDF rendering, API client, CSV builder
│   │   ├── App.tsx              # Main extraction workflow
│   │   └── types.ts             # Frontend types
│   ├── package.json
│   └── vite.config.ts
│
├── worker/
│   ├── src/
│   │   ├── lib/                 # Gemini client, prompts, validator
│   │   ├── routes/              # API routes
│   │   ├── index.ts             # Hono app entry point
│   │   └── types.ts             # Worker types
│   ├── package.json
│   └── wrangler.toml
│
└── README.md
```

## Extracted CSV Fields

The exported CSV includes the following columns:

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
```

## API

### `GET /api/health`

Returns a basic health check response.

```json
{
  "status": "ok",
  "service": "mbr-extractor-api"
}
```

### `POST /api/extract-page`

Extracts structured data from one rendered PDF page image.

Request body:

```json
{
  "image_base64": "base64-encoded-page-image",
  "page_number": 1,
  "mime_type": "image/jpeg"
}
```

Successful response:

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
        "needs_review": false
      }
    ]
  },
  "errors": [],
  "raw_text": "..."
}
```

## Local Development

### Prerequisites

- Node.js 20+
- npm
- Cloudflare Wrangler
- Gemini API key

### 1. Run the Worker

```bash
cd worker
npm install
```

Create `worker/.dev.vars`:

```bash
GEMINI_API_KEY=your-gemini-api-key
```

Start the Worker locally:

```bash
npm run dev
```

The Worker runs on `http://localhost:8787` by default.

### 2. Run the Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to the local Worker.

## Deployment

### Worker

```bash
cd worker
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

Optional Worker variable:

```toml
GEMINI_MODEL = "gemini-3-flash-preview"
```

`GEMINI_MODEL` is already configured in `worker/wrangler.toml`. Update it if the project should use a different Gemini model.

### Frontend

```bash
cd frontend
npm run build
npm run deploy
```

For production deployments where the frontend and Worker are on different origins, set:

```bash
VITE_API_URL=https://your-worker-domain.example.com/api
```

The Worker CORS configuration currently allows localhost development and the deployed Cloudflare Pages domain. Add any custom production domain to the Worker CORS allowlist before using a custom frontend domain.

## Review and Accuracy Notes

This project is designed to accelerate data extraction from MBR PDFs, not to replace human review. Extracted values should be checked before use in GMP, quality, regulatory, or batch-release workflows.

Important behavior:

- The app does not store uploaded PDFs or extracted rows in an application database.
- Page images are sent to the configured Gemini API for extraction.
- Missing actual values, missing performed-by initials, and missing verified-by initials are automatically flagged for review.
- Low-confidence or ambiguous fields should be corrected in the results table before CSV export.

## Current Scope

Included:

- Single-PDF upload
- Page-level extraction
- Editable review table
- CSV export
- Local session restore
- Cloudflare Pages and Workers deployment

Not included:

- User accounts
- Database persistence
- Audit trails
- Role-based review workflows
- Electronic signatures
- Validated GMP system controls

## Development Commands

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run deploy
```

### Worker

```bash
cd worker
npm run dev
npm run typecheck
npm run deploy
```

## Security and Privacy

- Keep `GEMINI_API_KEY` only on the Worker side.
- Do not expose Gemini credentials through frontend environment variables.
- Treat uploaded MBRs as sensitive manufacturing records.
- Review AI-extracted output before using it for operational or quality decisions.
- Add appropriate access controls, retention controls, and audit trails before adapting this MVP for regulated production use.

## License

No license file is currently included in this repository.
