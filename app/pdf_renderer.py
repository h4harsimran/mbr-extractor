"""Render PDF pages to high-resolution PNG images using PyMuPDF."""

from pathlib import Path

import fitz  # PyMuPDF

from app.config import settings
from app.models import PageImage
from app.utils import ensure_dir, page_image_path


def render_pdf(pdf_path: str | Path, doc_id: str) -> list[PageImage]:
    """Render every page of *pdf_path* to PNG and return a list of PageImage results.

    Images are saved to ``data/images/<doc_id>/page_NNNN.png``.
    """
    pdf_path = Path(pdf_path)
    output_dir = ensure_dir(settings.images_dir / doc_id)

    dpi = settings.render_dpi
    zoom = dpi / 72.0  # PyMuPDF default is 72 DPI
    matrix = fitz.Matrix(zoom, zoom)

    results: list[PageImage] = []

    doc = fitz.open(str(pdf_path))
    try:
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=matrix, alpha=False)

            img_path = page_image_path(doc_id, page_num + 1)  # 1-indexed
            pix.save(str(img_path))

            results.append(PageImage(page_number=page_num + 1, image_path=str(img_path)))
    finally:
        doc.close()

    return results
