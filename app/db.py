"""PostgreSQL database helpers — thin wrapper around psycopg2."""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone
from typing import Optional, Any

from app.config import settings

# ── Schema ──────────────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    mbr_types       TEXT,  -- JSON list of labels
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES products(id),
    lot_number      TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,
    original_filename TEXT NOT NULL,
    total_pages     INTEGER,
    status          TEXT NOT NULL DEFAULT 'uploaded',   -- uploaded | processing | completed | failed
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    error_message   TEXT,
    product_id      TEXT REFERENCES products(id),
    batch_id        TEXT REFERENCES batches(id),
    mbr_type        TEXT
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
    """Create tables if they don't exist and add missing columns."""
    with _get_conn() as conn:
        with conn.cursor() as cur:
            # Create tables
            cur.execute(_SCHEMA)
            
            # Migration: Add columns to documents if they don't exist
            # Note: PostgreSQL ALTER TABLE doesn't have IF NOT EXISTS for columns in older versions, 
            # but 9.6+ supports it. Supabase uses modern PG.
            cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES products(id)")
            cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES batches(id)")
            cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS mbr_type TEXT")


import json
import uuid

# ... (init_db is above)

# ── Document CRUD ───────────────────────────────────────────────────

def create_document(doc_id: str, filename: str, product_id: str = None, batch_id: str = None, mbr_type: str = None) -> dict:
    now = _now()
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO documents 
                   (id, original_filename, status, created_at, updated_at, product_id, batch_id, mbr_type) 
                   VALUES (%s, %s, 'uploaded', %s, %s, %s, %s, %s)""",
                (doc_id, filename, now, now, product_id, batch_id, mbr_type),
            )
    return get_document(doc_id)


def get_document(doc_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM documents WHERE id = %s", (doc_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def list_documents(product_id: str = None, batch_id: str = None) -> list[dict]:
    query = "SELECT * FROM documents"
    params = []
    
    where_clauses = []
    if product_id:
        where_clauses.append("product_id = %s")
        params.append(product_id)
    if batch_id:
        where_clauses.append("batch_id = %s")
        params.append(batch_id)
        
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
        
    query += " ORDER BY created_at DESC"
    
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
    return [dict(r) for r in rows]


def update_document(doc_id: str, **kwargs) -> None:
    if not kwargs:
        return
    
    # Whitelist allowed columns to prevent SQL injection
    ALLOWED_COLUMNS = {"total_pages", "status", "error_message", "updated_at", "product_id", "batch_id", "mbr_type"}
    
    kwargs["updated_at"] = _now()
    
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in ALLOWED_COLUMNS}
    if not filtered_kwargs:
        return

    sets = ", ".join(f"{k} = %s" for k in filtered_kwargs)
    vals = list(filtered_kwargs.values()) + [doc_id]
    
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE documents SET {sets} WHERE id = %s", vals)


# ── Product & Batch CRUD ───────────────────────────────────────────

def create_product(name: str, mbr_types: list[str]) -> dict:
    product_id = uuid.uuid4().hex[:12]
    now = _now()
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO products (id, name, mbr_types, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)",
                (product_id, name, json.dumps(mbr_types), now, now),
            )
    return get_product(product_id)


def list_products() -> list[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM products ORDER BY name ASC")
            rows = cur.fetchall()
    
    result = []
    for r in rows:
        d = dict(r)
        if d.get("mbr_types"):
            d["mbr_types"] = json.loads(d["mbr_types"])
        else:
            d["mbr_types"] = []
        result.append(d)
    return result


def get_product(product_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
            row = cur.fetchone()
    
    if not row:
        return None
        
    d = dict(row)
    if d.get("mbr_types"):
        d["mbr_types"] = json.loads(d["mbr_types"])
    else:
        d["mbr_types"] = []
    return d


def create_batch(product_id: str, lot_number: str) -> dict:
    batch_id = uuid.uuid4().hex[:12]
    now = _now()
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO batches (id, product_id, lot_number, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)",
                (batch_id, product_id, lot_number, now, now),
            )
    return get_batch(batch_id)


def list_batches(product_id: str = None) -> list[dict]:
    query = "SELECT * FROM batches"
    params = []
    if product_id:
        query += " WHERE product_id = %s"
        params.append(product_id)
    query += " ORDER BY created_at DESC"
    
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
    return [dict(r) for r in rows]


def get_batch(batch_id: str) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM batches WHERE id = %s", (batch_id,))
            row = cur.fetchone()
    return dict(row) if row else None


def get_batch_by_lot(product_id: str, lot_number: str) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM batches WHERE product_id = %s AND lot_number = %s",
                (product_id, lot_number),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def get_product_by_name(name: str) -> Optional[dict]:
    with _get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM products WHERE name = %s", (name,))
            row = cur.fetchone()
    
    if not row:
        return None
        
    d = dict(row)
    if d.get("mbr_types"):
        d["mbr_types"] = json.loads(d["mbr_types"])
    else:
        d["mbr_types"] = []
    return d


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
