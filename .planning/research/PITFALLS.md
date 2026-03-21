# Pitfalls Research — MBR Extractor v2

## Critical Pitfalls

### 1. Render Ephemeral Filesystem
- **What:** All local files (SQLite DB, uploaded PDFs, rendered PNGs) are lost on restart/redeploy
- **Warning signs:** Data disappears after deploy, users report missing documents
- **Prevention:** Migrate ALL persistent data to Supabase PostgreSQL before deploying to Render
- **Phase:** Must be Phase 1

### 2. Supabase Free Tier Pausing
- **What:** Free projects pause after 7 days of inactivity — database becomes inaccessible
- **Warning signs:** App errors after a week of no usage
- **Prevention:** Set up a keep-alive cron job (e.g., Render cron or external service pings the app)
- **Phase:** Deployment phase

### 3. Cold Start Latency
- **What:** Render free tier spins down after 15 min idle — first request takes 30-60s
- **Warning signs:** Users complain about slow initial loads
- **Prevention:** Add loading spinner/skeleton UI, keep-alive ping every 14 min
- **Phase:** Deployment phase

## High-Risk Pitfalls

### 4. Header Dedup Accuracy
- **What:** Gemini may extract slightly different header values across pages of the same PDF
- **Warning signs:** "Lot# 12345" on page 1, "Lot #12345" on page 5 treated as different
- **Prevention:** Normalize extracted headers (strip whitespace, standardize format), take majority vote across pages
- **Phase:** Extraction pipeline changes

### 5. Parameter Matching Across MBRs
- **What:** Same parameter may have slightly different labels across MBRs ("Cell Count" vs "Cell count (×10⁶)" vs "CC")
- **Warning signs:** Trend charts show gaps or duplicates
- **Prevention:** Allow users to define parameter aliases/templates per project
- **Phase:** Trending feature

### 6. Time-Series Data Alignment
- **What:** MBRs from different batches may use different date formats or relative days
- **Warning signs:** Overlay charts have misaligned x-axes
- **Prevention:** Normalize dates to relative "Day N" within batch, let users set batch start date
- **Phase:** Trending feature

## Medium-Risk Pitfalls

### 7. Browser IndexedDB Limits
- **What:** IndexedDB typically limited to ~50% of available disk (varies by browser)
- **Warning signs:** Image storage fails silently on mobile/low-storage devices
- **Prevention:** Implement storage quota checking, graceful degradation (re-render from server)
- **Phase:** Image storage migration

### 8. Auth State Management
- **What:** JWT tokens expire, Supabase session management across page refreshes
- **Warning signs:** Users get logged out randomly, API calls fail with 401
- **Prevention:** Implement token refresh flow, handle expired sessions gracefully
- **Phase:** Auth implementation

### 9. Large PDF Processing Timeout
- **What:** Still synchronous processing — large PDFs may timeout on Render free tier
- **Warning signs:** 50+ page PDFs fail to process
- **Prevention:** Use FastAPI BackgroundTasks for processing, add polling/status endpoint
- **Phase:** Should address alongside deployment
