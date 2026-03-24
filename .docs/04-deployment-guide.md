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

### Step A: Configure Environment Variables

Instead of setting variables in the terminal, we recommend using a `.env` file for production builds.

1. In the `frontend` folder, copy `.env.example` to `.env.production`:
   ```bash
   cp .env.example .env.production
   ```
2. Open `.env.production` in your editor and set `VITE_API_URL` to your Worker URL + `/api`.
   Example: `VITE_API_URL=https://mbr-extractor-api.<your-subdomain>.workers.dev/api`

### Step B: Build and Deploy

Now that your URL is saved in `.env.production`, you can build and deploy with these simple commands:

```bash
# 1. Build the production assets
npm run build

# 2. Deploy to Cloudflare Pages
npm run deploy
```

*(The first time you run deploy, Wrangler may ask you to create a new project. Choose a name like `mbr-extractor-frontend`.)*

---

## Alternative: GitHub CI/CD (Recommended)

The best way to deploy is using Cloudflare's GitHub integration.

1. Push your code to GitHub.
2. Go to the Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your repository.
4. **Configuration Settings:**
   - Framework preset: `Vite` (or `None`)
   - Build command: `npm run build`
   - Build output directory: `dist`
5. **Environment Variables:**
   - Add a variable named `VITE_API_URL`.
   - Set the value to the Worker URL (e.g., `https://.../api`).
6. Click **Save and Deploy**.

## Production Security Notes

1. **CORS:** The `worker/src/index.ts` file is configured via a whitelist. It explicitly allows the local development origin (`http://localhost:5173`) and the production Cloudflare Pages domain (`https://mbr-extractor-frontend.pages.dev`). Any other origins will be rejected.
2. **API Keys:** The Gemini API key is never exposed to the browser. It securely remains inside the Cloudflare Worker runtime environments.
