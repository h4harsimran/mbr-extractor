# Product Scope

MBR Extractor is a lightweight AI-assisted extraction tool for Master Batch Record PDFs. It renders PDF pages in the browser, sends page images to a Cloudflare Worker, asks Gemini for structured rows, validates the response, and lets a human review/edit before CSV export.

## In scope

- Browser PDF upload and page rendering.
- Per-page AI extraction through the Worker.
- Request limits that protect API cost.
- Zod validation, normalization, review warnings, and CSV export.
- Simple deployment to Cloudflare Pages and Workers.

## Out of scope

- Authentication, organizations, RBAC, billing, and SaaS admin areas.
- Database persistence, queues, R2/object storage, audit trails, electronic signatures, or GMP validation claims.
- Storing uploaded PDFs or extracted rows on the server.

## Compliance note

This project is not a validated GMP system. Use it as a portfolio/MVP tool with human review, not as the system of record for regulated release decisions.
