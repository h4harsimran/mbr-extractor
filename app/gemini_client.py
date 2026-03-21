"""Gemini multimodal client — sends page images and returns raw JSON."""

import base64
import json
import logging
import time
from pathlib import Path

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)

# ── Prompts ─────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert document extraction model for manufacturing batch records (MBR).
Read page images carefully and extract data into strict JSON only.

CRITICAL — ONE PARAMETER PER ROW:
- Each JSON output row must contain EXACTLY ONE parameter/measurement.
- If a single visual row on the page contains multiple sub-parameters (e.g. Step 9.25 lists
  "Full BAPH weight (g)", "Empty BAPH weight (g)", and "BAPH Cell Volume (mL)" together),
  you MUST split them into separate JSON rows — one row per parameter, each with its own
  parameter_label, actual_value, and units.
- NEVER combine multiple values with semicolons, slashes, or any delimiter in a single field.
- Each row_id should uniquely identify the sub-parameter (e.g. "9.25-A", "9.25-B", "9.25-C").

Preserve row relationships exactly.
Do not guess or infer values that are not visible on the page.
If a field is unreadable, return null and mark needs_review=true.
Return ONLY valid JSON matching the required schema — no markdown fences, no commentary."""

USER_PROMPT_TEMPLATE = """Extract all visible table rows and handwritten entries from this MBR page (page {page_number}) into the required JSON schema.

For each row, correctly associate:
- printed parameter or label
- handwritten actual value
- handwritten comments
- performed by initials/date
- verified by initials/date

CRITICAL — ONE PARAMETER PER OUTPUT ROW:
- Every output row must have exactly ONE parameter_label, ONE actual_value, and ONE units value.
- If a physical row on the page groups multiple sub-items (e.g. a step that lists weight, volume,
  and concentration together), split them into SEPARATE output rows.
- NEVER join multiple parameters or values with semicolons (;), slashes (/), or any delimiter.
- Use sub-IDs like "9.25-A", "9.25-B", "9.25-C" to distinguish split rows from the same step.

Example — if a page row shows:
  Step 9.25: Full BAPH weight (g) = 171.7 | Empty BAPH weight (g) = 66.0 | Cell Volume (mL) = 105.7
You MUST return THREE separate JSON rows:
  row_id "9.25-A": parameter_label "Full BAPH weight (g)", actual_value "171.7", units "g"
  row_id "9.25-B": parameter_label "Empty BAPH weight (g)", actual_value "66.0", units "g"
  row_id "9.25-C": parameter_label "BAPH Cell Volume (mL)", actual_value "105.7", units "mL"

Other rules:
- Keep each physical row separate. Do NOT merge neighboring rows.
- Do NOT hallucinate missing values.
- If a comment spans multiple lines within one row, combine it into one text field.
- If there are cuttings, strike-throughs, or overwritten values, capture the latest visible intended value if clear; otherwise set null and flag for review.
- extraction_confidence must be a float between 0.0 and 1.0.
- Set needs_review=true for any ambiguous, unreadable, or missing field.
- Preserve comments exactly as read where possible.
- For signatures/dates/comments that are ambiguous, return the visible portion only and add a reviewer_notes entry.

Required output schema:
{{
  "page_number": {page_number},
  "rows": [
    {{
      "page_number": {page_number},
      "row_id": "<unique sub-parameter id as string>",
      "parameter_label": "<ONE printed label or null>",
      "target_value": "<ONE printed target or null>",
      "actual_value": "<ONE handwritten value or null>",
      "units": "<ONE unit or null>",
      "comments": "<handwritten comment or null>",
      "performed_by_initials": "<initials or null>",
      "performed_date": "<date string or null>",
      "verified_by_initials": "<initials or null>",
      "verified_date": "<date string or null>",
      "reviewer_notes": "<model notes on ambiguity or null>",
      "extraction_confidence": <0.0 to 1.0>,
      "needs_review": <true|false>,
      "source_image_path": null
    }}
  ]
}}

Return valid JSON ONLY. No markdown code fences. No extra text."""

# ── Client ──────────────────────────────────────────────────────────


def _build_client() -> genai.Client:
    """Instantiate the Gemini GenAI client."""
    return genai.Client(api_key=settings.gemini_api_key)


def _encode_image(image_path: str | Path) -> str:
    """Base64-encode a PNG image."""
    return base64.b64encode(Path(image_path).read_bytes()).decode("utf-8")


def extract_page(image_path: str | Path, page_number: int) -> str:
    """Send a page image to Gemini and return the raw JSON response string.

    Retries with exponential backoff on transient errors.
    """
    client = _build_client()
    image_bytes = Path(image_path).read_bytes()

    user_prompt = USER_PROMPT_TEMPLATE.format(page_number=page_number)

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                types.Part.from_text(text=user_prompt),
            ],
        )
    ]

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.1,
        max_output_tokens=8192,
    )

    last_error: Exception | None = None
    for attempt in range(1, settings.max_retries + 1):
        try:
            logger.info(
                "Gemini request: page %d, attempt %d/%d",
                page_number, attempt, settings.max_retries,
            )
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=config,
            )

            raw_text = response.text.strip()

            # Strip markdown fences if model wraps anyway
            if raw_text.startswith("```"):
                lines = raw_text.split("\n")
                # Remove first and last fence lines
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()

            # Quick sanity check — must be parseable JSON
            json.loads(raw_text)
            return raw_text

        except json.JSONDecodeError as exc:
            last_error = exc
            logger.warning("Gemini returned invalid JSON on attempt %d: %s", attempt, exc)
        except Exception as exc:
            last_error = exc
            logger.warning("Gemini API error on attempt %d: %s", attempt, exc)

        if attempt < settings.max_retries:
            delay = settings.retry_base_delay * (2 ** (attempt - 1))
            logger.info("Retrying in %.1f s …", delay)
            time.sleep(delay)

    raise RuntimeError(
        f"Gemini extraction failed after {settings.max_retries} attempts: {last_error}"
    )
