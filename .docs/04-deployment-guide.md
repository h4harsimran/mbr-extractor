# 04 - Deployment Guide

This guide covers how to deploy the application to Cloudflare Workers and Cloudflare Pages.

## Prerequisites

1. A Cloudflare account.
2. Node.js (v18+) and npm installed.
3. A Google Gemini API Key.
4. Wrangler CLI authenticated with your Cloudflare account.
   ```bash
   npm install -g wrangler
   wrangler login
   ```

---

## 1. Deploy the Backend (Cloudflare Worker)

The worker acts as a proxy to the Gemini API and must be deployed first so you can get its URL.

```bash
cd worker
npm install
```

### Configure the Secret

Set your Gemini API key securely in Cloudflare:

```bash
npx wrangler secret put GEMINI_API_KEY
# The terminal will prompt you to paste your Google Gen AI key.
```

### Deploy to Cloudflare

```bash
npx wrangler deploy
```

Upon success, Wrangler will output a URL, looking something like:
`https://mbr-extractor-api.<your-subdomain>.workers.dev`

**Copy this URL.** You will need it for the frontend.

---

## 2. Deploy the Frontend (Cloudflare Pages)

```bash
cd frontend
npm install
```

### Connect to Github & Deploy via Cloudflare Dashboard (Recommended)

The easiest way to deploy the frontend is using Cloudflare's GitHub integration.

1. Push your code to GitHub.
2. Go to the Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your repository.
4. **Configuration Settings:**
   - Framework preset: `Vite` (or `None`)
   - Build command: `npm run build`
   - Build output directory: `dist`
5. **Environment Variables:**
   - Add a variable named `VITE_API_URL`.
   - Set the value to the Worker URL you copied earlier + `/api`.
   - Example: `https://mbr-extractor-api.<your-subdomain>.workers.dev/api`
6. Click **Save and Deploy**.

### Alternative: Deploy via Wrangler CLI

If you want to deploy directly from your local machine without GitHub integration:

Build the project locally, injecting the environment variable:

```bash
# Windows (PowerShell):
$env:VITE_API_URL="https://mbr-extractor-api.<your-subdomain>.workers.dev/api"
npm run build

# Mac/Linux:
VITE_API_URL="https://mbr-extractor-api.<your-subdomain>.workers.dev/api" npm run build
```

Then deploy the generated `dist` folder to Cloudflare Pages:

```bash
npx wrangler pages deploy dist --project-name mbr-extractor-frontend
```

## Production Security Notes

1. **CORS:** By default, the `worker/src/index.ts` file has `origin: '*'` in its CORS configuration. Before deploying to a production domain, you should tighten this to only allow your specific Cloudflare Pages domain (e.g., `origin: 'https://mbr-extractor.pages.dev'`).
2. **API Keys:** The Gemini API key is never exposed to the browser. It securely remains inside the Cloudflare Worker runtime environments.
