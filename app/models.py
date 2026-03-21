"""Lightweight data-transport types used internally."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class PageImage:
    """Result of rendering a single PDF page."""

    page_number: int
    image_path: str


@dataclass
class ProcessingResult:
    """Outcome of processing a single page."""

    page_number: int
    success: bool
    raw_json_path: Optional[str] = None
    normalized_json_path: Optional[str] = None
    error: Optional[str] = None
    needs_review_count: int = 0
    total_rows: int = 0
