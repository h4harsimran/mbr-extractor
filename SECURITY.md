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

## Local-only template and preview handling

- Scoped templates are browser-local aids stored in localStorage; exported template JSON can still contain sensitive process terminology and should be handled accordingly.
- Imported templates are untrusted input and are validated before loading or approval.
- Rendered page previews are intentionally memory-only and are excluded from localStorage/session persistence.
- Side-by-side review is for human verification only. This app is not a validated GMP system and does not provide electronic signatures or audit trails.
- Worker logging should remain generic and must not include raw model output, base64 images, request bodies, provider response bodies, document text, or API keys.
