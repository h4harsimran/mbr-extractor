# 02 - Data Flow & Extraction Pipeline

This document explains the step-by-step data lifecycle for extracting manufacturing batch record data.

## 1. Input Validation (Frontend)
- User drops a file in `FileUpload.tsx`.
- File type is verified as `application/pdf`.

## 2. PDF Rendering (`frontend/src/lib/pdf-renderer.ts`)
- `pdfjs-dist` loads the array buffer.
- For each page, the scale is set to target roughly 200 DPI.
- The page renders to an off-screen `<canvas>`.
- The canvas exports a base64 encoded JPEG representation of the page (quality 0.8) to minimize payload size.

## 3. Worker Extraction Call (`frontend/src/lib/extraction-client.ts`)
- Pages are processed concurrently by a `Promise` worker pool in `App.tsx` (set to 10 pages at a time).
- For each page, the frontend issues `POST /api/extract-page`.
- Payload: `{ image_base64: "...", page_number: 1, mime_type: "image/jpeg" }`.
- If a specific page request fails (API timeout, 500), the client retries up to 2 times with a 3-second delay.

## 4. Gemini Proxy (`worker/src/lib/gemini.ts`)
- Worker receives request.
- Selects `gemini-3-flash-preview` (or environment-configured model).
- Builds the specific `userPrompt` combining instructions and the current `page_number`.
- Uses system instructions (`SYSTEM_PROMPT`) from `worker/src/lib/prompts.ts` telling the model to output strict JSON.
- Receives text response. Strips markdown fences (` ```json `).

## 5. Validation (`worker/src/lib/validator.ts`)
- Uses `zod` to validate the Gemini JSON against the known contract.
- Applies business rules. Specifically, rows are automatically flagged (`needs_review: true`) if:
  - `actual_value` is null (the model couldn't find a handwritten value).
  - `performed_by_initials` is missing.
  - `verified_by_initials` is missing.
- Returns the typed `ExtractPageResponse` to the frontend.

## 6. Composition & UI Updates (`frontend/src/App.tsx`)
- Frontend receives the validated data for that page.
- Modifies React component state, updating the grid UI (`ExtractionProgress.tsx`) to show the page dot changing from "processing" to "completed".
- **Session Persistence:** The `appState`, `pages` list, and `filename` are mirrored to `localStorage`. This allows the user to refresh the page without losing progress or already extracted data.

## 7. Manual Review & Inline Editing (`ResultsView.tsx`)
- Once extraction is complete (or partially complete), the user enters the results view.
- An interactive data grid displays extracted rows.
- Users can manually edit `actual_value`, `parameter_label`, etc., to correct OCR/AI hallucinations.
- Manual edits are immediately saved back to the React state and `localStorage`.

## 8. CSV Build (`frontend/src/lib/csv-builder.ts`)
- Once the user is satisfied with the reviewed data, they click "Download CSV".
- The final dataset is flattened.
- The `lot_number` (often found only on page 1) is propagated down to every row in the final CSV.
- The CSV is triggered as a `<a download>` object URL, saving to the user's disk without ever touching server-side storage.
