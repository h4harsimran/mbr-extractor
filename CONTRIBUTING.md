# Contributing

Thank you for improving MBR Extractor. Keep changes small, reviewable, and aligned with the lightweight AI-assisted PDF extraction scope.

## Local setup

```bash
npm run install:all
npm run dev:worker
npm run dev:frontend
```

Use npm only. Do not introduce auth, database persistence, billing, organizations, queues, object storage, audit trails, or e-signature workflows.

## Quality checks

```bash
npm run typecheck
npm run test
npm run build
```

Mock Gemini/API calls in tests. Never commit real Gemini keys, real MBRs, or regulated sample data.

## Pull request expectations

- Explain user-visible behavior changes.
- Document new configuration.
- Include tests for validation, API error handling, and CSV behavior when practical.
- State any manual Cloudflare setup required.
