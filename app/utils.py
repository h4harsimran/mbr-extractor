"""Shared utility functions."""

import json
import uuid
from pathlib import Path
from typing import Any

from app.config import settings


import re

def sanitize_filename(name: str) -> str:
    """Make a string safe for use as a filename."""
    # Remove any characters that aren't alphanumeric, space, dot, or dash
    name = re.sub(r'[^\w\s\.-]', '', name)
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    # Truncate to reasonable length
    return name[:100]


def generate_document_id() -> str:
    """Create a short, unique document identifier."""
    return uuid.uuid4().hex[:12]


def ensure_dir(path: Path) -> Path:
    """Create directory (and parents) if it doesn't exist, return path."""
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_json(data: Any, path: Path) -> None:
    """Serialize *data* to JSON and write to *path*."""
    ensure_dir(path.parent)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def load_json(path: Path) -> Any:
    """Read and parse a JSON file."""
    return json.loads(path.read_text(encoding="utf-8"))


# ── Path builders ──────────────────────────────────────────────────

def doc_images_dir(doc_id: str) -> Path:
    return ensure_dir(settings.images_dir / doc_id)


def doc_raw_json_dir(doc_id: str) -> Path:
    return ensure_dir(settings.raw_json_dir / doc_id)


def doc_normalized_json_dir(doc_id: str) -> Path:
    return ensure_dir(settings.normalized_json_dir / doc_id)


def doc_export_path(doc_id: str) -> Path:
    ensure_dir(settings.exports_dir)
    return settings.exports_dir / f"{doc_id}.csv"


def page_image_path(doc_id: str, page_num: int) -> Path:
    return doc_images_dir(doc_id) / f"page_{page_num:04d}.png"


def page_raw_json_path(doc_id: str, page_num: int) -> Path:
    return doc_raw_json_dir(doc_id) / f"page_{page_num:04d}_raw.json"


def page_normalized_json_path(doc_id: str, page_num: int) -> Path:
    return doc_normalized_json_dir(doc_id) / f"page_{page_num:04d}_normalized.json"
