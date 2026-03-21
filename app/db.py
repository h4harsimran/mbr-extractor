"""PostgreSQL database helpers — thin wrapper around psycopg2."""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone
from typing import Optional, Any

from app.config import settings

# ── Schema ──────────────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,
    original_filename TEXT NOT NULL,
    total_pages     INTEGER,
    status          TEXT NOT NULL DEFAULT 'uploaded',   -- uploaded | processing | completed | failed
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    error_message   TEXT
);

CREATE TABLE IF NOT EXISTS pages (
    id              SERIAL PRIMARY KEY,
    document_id     TEXT NOT NULL REFERENCES documents(id),
    page_number     INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',   -- pending | processing | completed | failed
    image_path      TEXT,
    raw_json_path   TEXT,
    normalized_json_path TEXT,
    error_message   TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_conn():
    """Get a connection to the PostgreSQL database."""
    if not settings.database_url:
        raise ValueError("DATABASE_URL is not set in environment variables.")
    
    conn = psycopg2.connect(settings.database_url, cursor_factory=RealDictCursor)
    conn.autocommit = True  # Simple mode: commit on every execute
    return conn


def init_db() -> None:
    """Create tables if they don't exist."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(_SCHEMA)


# ── Document CRUD ───────────────────────────────────────────────────

def create_document(doc_id: str, filename: str) -> dict:
    now = _now()
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO documents (id, original_filename, status, created_at, updated_at) VALUES (%s, %s, 'uploaded', %s, %s)",
                (doc_id, filename, now, now),
            )
    return get_document(doc_id)


def get_document(doc_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM documents WHERE id = %s", (doc_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def list_documents() -> list[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM documents ORDER BY created_at DESC")
            rows = cur.fetchall()
    return [dict(r) for r in rows]


def update_document(doc_id: str, **kwargs) -> None:
    if not kwargs:
        return
    
    # Whitelist allowed columns to prevent SQL injection
    ALLOWED_COLUMNS = {"total_pages", "status", "error_message", "updated_at"}
    
    kwargs["updated_at"] = _now()
    
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in ALLOWED_COLUMNS}
    if not filtered_kwargs:
        return

    sets = ", ".join(f"{k} = %s" for k in filtered_kwargs)
    vals = list(filtered_kwargs.values()) + [doc_id]
    
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE documents SET {sets} WHERE id = %s", vals)


# ── Page CRUD ───────────────────────────────────────────────────────

def create_page(document_id: str, page_number: int, image_path: str) -> int:
    now = _now()
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pages (document_id, page_number, image_path, status, created_at, updated_at) VALUES (%s, %s, %s, 'pending', %s, %s) RETURNING id",
                (document_id, page_number, image_path, now, now),
            )
            page_id = cur.fetchone()["id"]
    return page_id


def get_pages(document_id: str) -> list[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM pages WHERE document_id = %s ORDER BY page_number", (document_id,)
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]


def get_page(document_id: str, page_number: int) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM pages WHERE document_id = %s AND page_number = %s",
                (document_id, page_number),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def update_page(page_id: int, **kwargs) -> None:
    if not kwargs:
        return

    # Whitelist allowed columns to prevent SQL injection
    ALLOWED_COLUMNS = {"status", "image_path", "raw_json_path", "normalized_json_path", "error_message", "updated_at"}
    
    kwargs["updated_at"] = _now()
    
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in ALLOWED_COLUMNS}
    if not filtered_kwargs:
        return

    sets = ", ".join(f"{k} = %s" for k in filtered_kwargs)
    vals = list(filtered_kwargs.values()) + [page_id]
    
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE pages SET {sets} WHERE id = %s", vals)
