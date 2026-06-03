# Product Scope

MBR Extractor is a lightweight AI-assisted extraction tool for Master Batch Record PDFs. It renders PDF pages in the browser, sends page images to a Cloudflare Worker, asks Gemini for structured rows, validates the response, and lets a human review/edit before CSV export.

## In scope

- Browser PDF upload and page rendering.
- Full per-page AI extraction through the Worker.
- Scoped Extraction: user-provided parameter lists are converted into a validated, reviewed `ScopedExtractionPlan`, then page extraction returns only requested scoped parameters.
- Request limits that protect API cost, including scoped input length and parameter-count limits.
- Zod validation, normalization, review warnings, missing scoped-result flags, and CSV export.
- Simple deployment to Cloudflare Pages and Workers.

## Out of scope

- Authentication, organizations, RBAC, billing, and SaaS admin areas.
- Database persistence, queues, R2/object storage, audit trails, electronic signatures, or GMP validation claims.
- Server-side scope persistence; scoped plans are kept in frontend state/localStorage for the current MVP session.
- Storing uploaded PDFs or extracted rows on the server.

## Compliance note

This project is not a validated GMP system. Use it as a portfolio/MVP tool with human review, not as the system of record for regulated release decisions.

## 2026 scoped review and template additions

- The product now supports a side-by-side review workspace for full and scoped extraction results.
- The workspace keeps rendered page previews in React memory only; previews are not written to localStorage or server-side storage.
- Review queue items are derived from existing row review flags: full rows with `needs_review`, and scoped rows with `needs_review` or `matched === false`.
- Scoped extraction templates are local-only browser aids for reusing parameter plans. They do not add authentication, organizations, database persistence, billing, audit trails, signatures, queues, R2, or SaaS administration.
- Imported templates are treated as untrusted JSON and must pass deterministic frontend validation before loading. Users must still approve loaded templates before scoped extraction starts.

## Final production-readiness boundaries

- Side-by-side review is for human verification only and is not a validated GMP review, electronic signature, audit-trail, or release-decision system.
- Scoped templates are local browser data only. Exports may contain sensitive process parameter names and expected units.
- Imported templates are untrusted JSON. They are validated before use and must be approved by the user before scoped extraction can run.
- Page previews are rendered page images kept in memory-only React state and intentionally not persisted to localStorage.
- No uploaded PDFs are intentionally stored server-side.
