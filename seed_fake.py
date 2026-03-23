import uuid
import json
import os
import random
from app import db
from app.utils import save_json, ensure_dir
from app.config import settings

def create_fake_data():
    os.makedirs(settings.data_dir, exist_ok=True)
    
    # 1. Product
    product_name = "T-Cell Therapy (FAKE-01)"
    mbr_types = ["Day 0 Seeding", "Day 1 Expansion", "Day 2 Expansion", "Day 3 Harvest"]
    
    prod_id = uuid.uuid4().hex[:12]
    
    with db._get_conn() as conn:
        with conn.cursor() as cur:
            now = db._now()
            cur.execute(
                "INSERT INTO products (id, name, mbr_types, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)",
                (prod_id, product_name, json.dumps(mbr_types), now, now)
            )
            
    # 2. Batches
    lots = [
        {"lot": "LOT-A (Nominal)", "base_conc": 1.0, "viab_drop": 1.0},
        {"lot": "LOT-B (High Growth)", "base_conc": 1.2, "viab_drop": 1.5},
        {"lot": "LOT-C (Slow Growth)", "base_conc": 0.8, "viab_drop": 0.8},
    ]
    
    for l_data in lots:
        batch_id = uuid.uuid4().hex[:12]
        with db._get_conn() as conn:
            with conn.cursor() as cur:
                now = db._now()
                cur.execute(
                    "INSERT INTO batches (id, product_id, lot_number, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)",
                    (batch_id, prod_id, l_data["lot"], now, now)
                )
        
        # 3. Documents & Data
        for day_idx, mbr_type in enumerate(mbr_types):
            doc_id = uuid.uuid4().hex[:12]
            filename = f"{mbr_type.replace(' ', '_')}_{l_data['lot']}.pdf"
            b_conc = l_data["base_conc"]
            
            # Growth math
            conc = b_conc * (2.2 ** day_idx) + random.uniform(-0.2, 0.2)
            viab = 99.5 - (l_data["viab_drop"] * day_idx) + random.uniform(-0.5, 0.5)
            vol = 50 * (2 ** day_idx)
            
            print(f"Creating {filename} for {l_data['lot']}")
            
            # document
            with db._get_conn() as conn:
                with conn.cursor() as cur:
                    now = db._now()
                    # Keep them sorted chronologically by using a faked creation date
                    create_date = f"2026-06-0{day_idx+1}T12:00:00Z"
                    cur.execute(
                        "INSERT INTO documents (id, original_filename, total_pages, status, created_at, updated_at, product_id, batch_id, mbr_type) VALUES (%s, %s, 1, 'completed', %s, %s, %s, %s, %s)",
                        (doc_id, filename, create_date, now, prod_id, batch_id, mbr_type)
                    )
                    
                    cur.execute(
                        "INSERT INTO pages (document_id, page_number, status, created_at, updated_at) VALUES (%s, 1, 'completed', %s, %s)",
                        (doc_id, now, now)
                    )
            
            # Page Extraction JSON
            from pathlib import Path
            norm_dir = Path(settings.normalized_json_dir) / doc_id
            norm_dir.mkdir(parents=True, exist_ok=True)
            norm_path = norm_dir / "page_0001_normalized.json"
            
            page_data = {
                "page_number": 1,
                "status": "completed",
                "rows": [
                    {
                        "row_id": "1",
                        "parameter_label": "Live cells conc",
                        "target_value": "> 0.5",
                        "actual_value": f"{conc:.2f}",
                        "units": "x 10^6 cells/mL",
                        "comments": "",
                        "performed_by_initials": "AUTO",
                        "verified_by_initials": "AUTO",
                        "extraction_confidence": 0.99,
                        "needs_review": False
                    },
                    {
                        "row_id": "2",
                        "parameter_label": "Viability (%)",
                        "target_value": "> 80%",
                        "actual_value": f"{viab:.1f}",
                        "units": "%",
                        "comments": "",
                        "performed_by_initials": "AUTO",
                        "verified_by_initials": "AUTO",
                        "extraction_confidence": 0.99,
                        "needs_review": False
                    },
                    {
                        "row_id": "3",
                        "parameter_label": "Culture Volume",
                        "target_value": "",
                        "actual_value": f"{vol:.1f}",
                        "units": "mL",
                        "comments": "",
                        "performed_by_initials": "AUTO",
                        "verified_by_initials": "AUTO",
                        "extraction_confidence": 0.99,
                        "needs_review": False
                    }
                ]
            }
            save_json(page_data, norm_path)
            
            # Export CSV cache manually to guarantee it's available quickly
            from app.exporter import export_csv
            export_csv(doc_id)

if __name__ == "__main__":
    create_fake_data()
    print("Fake data seeded successfully!")
