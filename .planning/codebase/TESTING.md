# Testing

## Framework

| Aspect | Detail |
|--------|--------|
| Framework | pytest (≥ 8.0.0) |
| Run command | `python -m pytest tests/ -v` |
| Test directory | `tests/` |
| Test files | `test_schemas.py`, `test_exporter.py` |

---

## Test Coverage

### `tests/test_schemas.py` (98 lines)
Tests Pydantic model validation and auto-flagging logic.

**`TestExtractedRow` (7 tests):**
- `test_valid_row` — happy path with all fields populated
- `test_confidence_out_of_range` — rejects confidence > 1.0
- `test_confidence_negative` — rejects confidence < 0.0
- `test_null_actual_value_flags_review` — auto-flags when `actual_value` is null
- `test_missing_performed_by_flags_review` — auto-flags when initials missing
- `test_missing_verified_by_flags_review` — auto-flags when verifier missing
- `test_all_optional_fields_null` — verifies auto-flagging with minimal data

**`TestPageExtraction` (3 tests):**
- `test_empty_rows` — page with no rows
- `test_with_rows` — page with valid rows
- `test_page_number_required` — validates required field

**Pattern:** Uses `_base(**overrides)` helper to construct test data with selective field overrides.

---

### `tests/test_exporter.py` (128 lines)
Tests CSV export logic with isolated temp environment.

**`TestCSVExport` (2 tests):**
- `test_export_creates_csv` — verifies CSV file creation, column headers, row data, and metadata injection
- `test_export_no_pages` — verifies empty CSV for document with no processed pages

**Test isolation pattern:**
- `autouse=True` fixture `_setup_env` that:
  - Points `DATA_DIR` and `DB_PATH` to `tmp_path`
  - Sets dummy `GEMINI_API_KEY`
  - Creates fresh `Settings()` instance
  - Patches `settings` across all modules (`app.config`, `app.db`, `app.utils`, `app.exporter`)
  - Initializes fresh SQLite database
- Tests create document records, write normalized JSON files, then verify CSV output

---

## Coverage Gaps

The following modules have **no tests**:

| Module | Risk |
|--------|------|
| `app/gemini_client.py` | Gemini API interaction, retry logic, prompt formatting |
| `app/validator.py` | JSON parsing, Pydantic validation pipeline, warning collection |
| `app/extractor.py` | Full pipeline orchestration, error handling per page |
| `app/pdf_renderer.py` | PDF → PNG rendering |
| `app/main.py` | All API routes, file upload, review UI |
| `app/db.py` | SQLite CRUD operations |
| `app/utils.py` | Path building, JSON serialization |

---

## Testing Patterns

- **No mocking of external services:** Tests don't mock Gemini API (no integration/e2e tests)
- **Filesystem isolation:** Test exporter uses `tmp_path` for all data
- **Settings patching:** `monkeypatch.setattr` to replace `settings` in each module
- **No CI configuration:** No `.github/workflows`, `tox.ini`, or similar
- **No fixtures file:** Fixtures defined inline in test files
- **No parameterized tests:** Each test case is a separate method
