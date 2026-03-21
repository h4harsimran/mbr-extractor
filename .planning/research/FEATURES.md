# Features Research — MSAT Batch Analytics

## Table Stakes (Users Expect These)

### Data Extraction
- PDF upload and AI-powered structured extraction ✓ (existing)
- One parameter per row with confidence scoring ✓ (existing)
- Validation with auto-flagging for human review ✓ (existing)
- CSV/Excel export ✓ (existing)

### Document Organization
- **Header metadata dedup** — product, lot#, MBR name extracted once, not repeated per page
- **Meaningful identifiers** — lot# + MBR name instead of random hex IDs
- **Project/product grouping** — organize MBRs by product

### Data Visualization
- **Parameter trending** — chart cell count, viability, confluency over days within a batch
- **Batch comparison** — overlay trend graphs from multiple batches of same product
- **Parameter selection** — user picks which parameters to trend

### User Experience
- **Polished, premium UI** — not generic/AI-looking
- **Non-technical user friendly** — self-explanatory navigation, clear labels
- **Online access** — deployed and accessible via URL

## Differentiators (Competitive Advantage)

### Advanced Analytics
- **Statistical overlays** — mean/median/range bands across batch comparisons
- **Anomaly detection** — auto-flag batches where parameters deviate from historical norms
- **Parameter correlation** — show relationships between parameters (e.g., cell count vs viability)

### Process Intelligence
- **Template management** — define expected parameters per MBR type, flag missing entries
- **Batch health scoring** — aggregate metrics per batch (% within spec, confidence score)
- **Process stage tracking** — map MBR steps to process stages for better visualization context

## Anti-Features (Deliberately NOT Building)

- **Real-time instrument integration** — out of scope, this is a post-hoc analysis tool
- **Regulatory compliance features (21 CFR Part 11)** — not an EBR replacement
- **Multi-user collaboration** — single-user workflow per project for now
- **Mobile-native app** — web-responsive sufficient
