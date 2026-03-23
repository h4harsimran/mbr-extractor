"""Integration tests for PostgreSQL database layer."""

import os
import pytest
from app import db
from app.config import settings

# Skip these tests if DATABASE_URL is not provided
pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL") and not settings.database_url,
    reason="DATABASE_URL environment variable not set for integration tests"
)

@pytest.fixture(scope="module")
def database():
    """Ensure database is initialized."""
    db.init_db()
    yield

def test_document_crud(database):
    doc_id = "test_doc_pg_001"
    filename = "test_record.pdf"
    
    # Create
    doc = db.create_document(doc_id, filename)
    assert doc["id"] == doc_id
    assert doc["original_filename"] == filename
    assert doc["status"] == "uploaded"
    
    # Get
    fetched = db.get_document(doc_id)
    assert fetched["id"] == doc_id
    
    # List
    docs = db.list_documents()
    assert any(d["id"] == doc_id for d in docs)
    
    # Update
    db.update_document(doc_id, status="processing", total_pages=5)
    updated = db.get_document(doc_id)
    assert updated["status"] == "processing"
    assert updated["total_pages"] == 5
    assert updated["updated_at"] > updated["created_at"]

def test_page_crud(database):
    doc_id = "test_doc_pg_002"
    db.create_document(doc_id, "pages.pdf")
    
    # Create
    page_id = db.create_page(doc_id, 1, "/path/to/img1.png")
    assert isinstance(page_id, int)
    
    # Get by document
    pages = db.get_pages(doc_id)
    assert len(pages) == 1
    assert pages[0]["id"] == page_id
    
    # Get single
    page = db.get_page(doc_id, 1)
    assert page["id"] == page_id
    assert page["image_path"] == "/path/to/img1.png"
    
    # Update
    db.update_page(page_id, status="completed", normalized_json_path="/raw/1.json")
    updated = db.get_page(doc_id, 1)
    assert updated["status"] == "completed"
    assert updated["normalized_json_path"] == "/raw/1.json"

def test_product_and_batch_crud(database):
    # 1. Create Product
    prod_name = "Product Alpha"
    mbr_types = ["Inoculation", "Harvest"]
    product = db.create_product(prod_name, mbr_types)
    assert product["name"] == prod_name
    assert product["mbr_types"] == mbr_types
    
    # 2. Create Batch
    lot = "LOT-101"
    batch = db.create_batch(product["id"], lot)
    assert batch["product_id"] == product["id"]
    assert batch["lot_number"] == lot
    
    # 3. List
    prods = db.list_products()
    assert any(p["id"] == product["id"] for p in prods)
    
    batches = db.list_batches(product["id"])
    assert len(batches) == 1
    assert batches[0]["id"] == batch["id"]

def test_document_with_hierarchy(database):
    # Setup hierarchy
    product = db.create_product("Hierarchy Test", ["Op1"])
    batch = db.create_batch(product["id"], "L-999")
    
    # Create document linked to batch
    doc_id = "linked_doc_001"
    db.create_document(
        doc_id, 
        "batch.pdf", 
        product_id=product["id"], 
        batch_id=batch["id"], 
        mbr_type="Op1"
    )
    
    # Verify retrieval
    doc = db.get_document(doc_id)
    assert doc["product_id"] == product["id"]
    assert doc["batch_id"] == batch["id"]
    assert doc["mbr_type"] == "Op1"
    
    # List filtered
    batch_docs = db.list_documents(batch_id=batch["id"])
    assert len(batch_docs) == 1
    assert batch_docs[0]["id"] == doc_id

def test_sql_injection_fix(database):
    """Verify that update functions ignore non-whitelisted columns."""
    doc_id = "test_doc_injection_2"
    db.create_document(doc_id, "safe.pdf")
    
    # Attempt to inject or change restricted field via kwargs
    # 'original_filename' is NOT in the document whitelist
    db.update_document(doc_id, status="failed", original_filename="HACKED.pdf")
    
    fetched = db.get_document(doc_id)
    assert fetched["status"] == "failed"
    assert fetched["original_filename"] == "safe.pdf"  # Should NOT have changed
    
    # Verify new columns can be updated if in whitelist
    prod = db.create_product("Update Test", [])
    db.update_document(doc_id, product_id=prod["id"])
    updated = db.get_document(doc_id)
    assert updated["product_id"] == prod["id"]
