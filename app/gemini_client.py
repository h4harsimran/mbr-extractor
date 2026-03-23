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
- Split merged parameters into separate rows with their own label, value, and units.
- row_id should uniquely identify the sub-parameter.

METADATA:
- Extract the "Batch Lot Number" or "Lot#" if it appears in the page header, footer, or metadata section.
- Put this in the top-level "lot_number" field once per page. Do NOT repeat it in every data row.

Preserve row relationships exactly.
Do not guess or infer values that are not visible on the page.
Return ONLY valid JSON matching the required schema — no markdown fences, no commentary."""

USER_PROMPT_TEMPLATE = """Extract all visible table rows and handwritten entries from this MBR page (page {page_number}) into the required JSON schema.

Identify the **Batch Lot Number** (Lot#) typically found in the header or footer.

For each data row, correctly associate:
- printed parameter or label
- handwritten actual value
- handwritten comments
- initials and dates for performed-by and verified-by

Rules:
- ONE PARAMETER PER OUTPUT ROW. Split grouped parameters into separate items.
- extraction_confidence must be a float between 0.0 and 1.0.
- Set needs_review=true for any ambiguous or missing field.
- Return valid JSON ONLY matching the provided template.

Required output schema:
{{
  "page_number": {page_number},
  "lot_number": "<extracted Lot# or null>",
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
      "extraction_confidence": <0.0 to 1.0>,
      "needs_review": <true|false>
    }}
  ]
}}"""

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
