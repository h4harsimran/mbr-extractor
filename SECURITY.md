# Security Policy

MBR Extractor treats Master Batch Records and page images as sensitive manufacturing records.

## Supported versions

Security fixes target the current `main` branch.

## Reporting vulnerabilities

Please open a private GitHub security advisory or contact the repository owner before public disclosure. Include reproduction steps, affected endpoints, and whether any sensitive data could be exposed.

## Security posture

- Gemini API keys must be stored only as Cloudflare Worker secrets.
- Uploaded PDFs are not intentionally stored by the app.
- Extracted rows are kept in browser state/localStorage only for local session restore.
- Page images are sent to the Worker and Gemini for extraction.
- Raw model output is hidden unless `DEBUG_RAW_MODEL_OUTPUT=true` is explicitly configured for debugging.
- Do not upload real regulated, customer, patient, or proprietary MBRs to public demos.
