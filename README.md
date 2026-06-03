# MBR Extractor — TypeScript Edition

AI-powered extraction of structured data from scanned Master Batch Record (MBR) PDFs. Upload a PDF, get a CSV.

Live demo: https://mbr-extractor-frontend.pages.dev

## Architecture

```
┌─────────────────────────┐     ┌──────────────────────────┐
│   Frontend (CF Pages)   │     │   Worker (CF Workers)    │
│                         │     │                          │
│  PDF ──► pdf.js ──► PNG │────►│  POST /api/extract-page  │
│  (browser rendering)    │     │  base64 image ──► Gemini │
│                         │◄────│  ◄── validated JSON      │
│  Collect all pages      │     │                          │
│  ──► Build CSV          │     └──────────────────────────┘
│  ──► Download           │
└─────────────────────────┘
```

- **Frontend**: React + Vite on Cloudflare Pages
- **Backend**: Hono on Cloudflare Workers (Gemini API proxy)
- **No database, no auth** — MVP for data extraction

## Quick Start

### 1. Worker (Backend)

```bash
cd worker
npm install

# Set your Gemini API key for local dev
echo "GEMINI_API_KEY=your-key-here" > .dev.vars

# Start dev server (port 8787)
npx wrangler dev
```

### 2. Frontend

```bash
cd frontend
npm install

# Start dev server (port 5173, proxies /api to :8787)
npm run dev
```

### 3. Use It

1. Open http://localhost:5173
2. Upload an MBR PDF
3. Watch page-by-page extraction progress
4. Download the CSV

## Deployment

### Deploy Worker

```bash
cd worker
npx wrangler secret put GEMINI_API_KEY   # Enter your key
npx wrangler deploy
```

### Deploy Frontend

```bash
cd frontend
npm run build
# Deploy dist/ to Cloudflare Pages
# Set VITE_API_URL env var to your deployed worker URL
```

## How It Handles 100-Page PDFs

1. PDF pages are rendered to images **in the browser** using pdf.js
2. Each page is sent individually to the worker (~200-500KB per request)
3. Worker proxies to Gemini and returns validated JSON
4. Progress tracking shows real-time status for each page
5. CSV is assembled client-side from all successful extractions
