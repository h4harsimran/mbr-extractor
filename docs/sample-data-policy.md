# Sample Data Policy

Only synthetic sample data may be committed or shown in screenshots.

Do not commit:

- Real MBRs, batch records, COAs, SOPs, labels, or proprietary manufacturing documents.
- Customer, patient, employee, supplier, facility, product, or lot identifiers from real operations.
- Gemini API keys, Cloudflare tokens, or `.dev.vars` files.

Synthetic samples should be clearly fictional and should not resemble a real regulated record closely enough to create confidentiality or compliance risk.

## Template and review data policy

- Do not commit real MBRs, real batch data, real rendered page previews, or screenshots containing regulated/client data.
- Exported scoped templates can reveal process parameter names, synonyms, expected units, and internal terminology. Treat them as sensitive when they reflect real processes.
- Local template testing should use synthetic parameter names or deliberately generic examples.
- Side-by-side review screenshots for documentation must use sanitized PDFs and synthetic extraction rows only.

## Browser-local artifacts

- Page previews are memory-only and intentionally not persisted. Do not save or commit rendered page previews, data URLs, or base64 page images.
- Templates saved or exported from the browser may contain sensitive process parameter names, expected units, and synonyms. Use synthetic templates for demos, tests, and documentation.
- Imported templates should be treated as untrusted even when they appear to be local files.
