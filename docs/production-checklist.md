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

```bash
npm run deploy --prefix worker
npx wrangler secret put GEMINI_API_KEY --cwd worker
```

Configure Worker variables in `worker/wrangler.toml` or the Cloudflare dashboard.

## Recommended rate limit

In the Cloudflare dashboard, add a rate-limit/WAF rule for `POST /api/extract-page`, for example: block or challenge excessive requests per IP over a short window. Start conservatively and adjust based on demo traffic.

## Privacy and security

- Do not upload real regulated or proprietary MBRs to public demos.
- Page images are sent to Gemini for extraction.
- The app does not intentionally store uploaded PDFs or extracted rows server-side.
- Confirm security headers are present on Pages and Worker responses.
