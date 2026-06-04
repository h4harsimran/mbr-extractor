# Production Checklist

## Configuration

- Store `GEMINI_API_KEY` as a Worker secret.
- Set `ALLOWED_ORIGINS` to exact production Pages domains.
- Keep `DEBUG_RAW_MODEL_OUTPUT=false` in production.
- Tune `MAX_REQUEST_BYTES` and `MAX_IMAGE_BASE64_CHARS` for expected page render sizes.
- Set frontend `VITE_API_URL` to the deployed Worker API base URL.

## Cloudflare Pages

- Build command: `npm run build --prefix frontend`
- Build output directory: `frontend/dist`
- Root directory: repository root
- Environment variable: `VITE_API_URL=https://<worker-domain>/api`

## Cloudflare Worker

`worker/wrangler.toml` is the production config and deploys the `mbr-extractor-api` Worker. Keep `worker/wrangler.preview.toml` for dev/preview deploys to the separate `mbr-extractor` Worker so branch merges do not retarget production deployments.

Production deploy:

```bash
npm run deploy --prefix worker
npx wrangler secret put GEMINI_API_KEY --cwd worker
```

Dev/preview deploy:

```bash
npx wrangler deploy --config worker/wrangler.preview.toml
npx wrangler secret put GEMINI_API_KEY --config worker/wrangler.preview.toml
```

Configure non-secret Worker variables in the appropriate Wrangler config file or the Cloudflare dashboard. Do not commit secrets.

## Recommended rate limit

In the Cloudflare dashboard, add a rate-limit/WAF rule for `POST /api/extract-page`, for example: block or challenge excessive requests per IP over a short window. Start conservatively and adjust based on demo traffic.

## Privacy and security

- Do not upload real regulated or proprietary MBRs to public demos.
- Page images are sent to Gemini for extraction.
- The app does not intentionally store uploaded PDFs or extracted rows server-side.
- Confirm security headers are present on Pages and Worker responses.

## Scoped review/template hardening checks

- Confirm `/api/build-scope` rejects oversized JSON bodies even when `Content-Length` is absent or unreliable.
- Confirm scoped schema validation rejects duplicate `parameter_id` values and instruction-like text in names, descriptions, synonyms, and units.
- Confirm direct pushes to both `main` and `dev` trigger CI.
- Confirm rendered page previews remain in memory only and are not saved to localStorage.
- Confirm scoped templates are saved only to browser localStorage and can be exported/imported as JSON.
- Confirm imported scoped templates require user review and approval before extraction.

## Final verification additions

- Verify side-by-side review works for both full and scoped modes, scoped mode shows only page-level matches or an empty page state, and the UI communicates that human verification is required.
- Verify scoped extraction cannot start unless a valid scope is approved; final by-parameter results preserve scope order and report each missing parameter once at document level.
- Verify retrying a page replaces that page preview and scoped matches for that page only, and reset clears all previews.
- Verify session localStorage contains no `pagePreviews`, `dataUrl`, or `base64Image` keys.
- Verify imported template ID collisions create renamed local templates and never overwrite existing local templates.
- Verify scoped CSV exports compiled results in scope order and does not emit one missing row per parameter per page.
- Verify exported templates are handled as sensitive because they can contain process parameter names.
- Verify Worker logs and client responses do not include raw model output, request JSON bodies, page image base64, provider response bodies, uploaded document text, or API keys. Raw model output should be returned only with `DEBUG_RAW_MODEL_OUTPUT=true`.
- Verify CI triggers on push to both `dev` and `main`.
