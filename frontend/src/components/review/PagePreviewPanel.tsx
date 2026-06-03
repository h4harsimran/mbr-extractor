import type { PagePreview } from "../../types";

interface Props {
  preview?: PagePreview;
  pageNumber: number;
  pageNumbers: number[];
  zoom: "fit" | 0.75 | 1 | 1.25;
  onZoomChange: (zoom: "fit" | 0.75 | 1 | 1.25) => void;
  onPageChange: (pageNumber: number) => void;
}

export default function PagePreviewPanel({ preview, pageNumber, pageNumbers, zoom, onZoomChange, onPageChange }: Props) {
  return (
    <section className="review-preview-panel" aria-label="PDF page preview">
      <div className="review-toolbar">
        <button className="btn btn-secondary" disabled={pageNumbers.indexOf(pageNumber) <= 0} onClick={() => onPageChange(pageNumbers[Math.max(0, pageNumbers.indexOf(pageNumber) - 1)])}>Previous page</button>
        <strong>Page {pageNumber}</strong>
        <button className="btn btn-secondary" disabled={pageNumbers.indexOf(pageNumber) === pageNumbers.length - 1} onClick={() => onPageChange(pageNumbers[Math.min(pageNumbers.length - 1, pageNumbers.indexOf(pageNumber) + 1)])}>Next page</button>
      </div>
      <div className="review-toolbar" aria-label="Zoom controls">
        {["fit", 0.75, 1, 1.25].map((item) => <button key={String(item)} className="btn btn-secondary" onClick={() => onZoomChange(item as "fit" | 0.75 | 1 | 1.25)}>{item === "fit" ? "Fit width" : `${Number(item) * 100}%`}</button>)}
      </div>
      <p className="upload-hint">Image highlighting requires bounding-box extraction and is not enabled yet.</p>
      <div className="page-preview-frame">
        {preview ? <img src={preview.dataUrl} alt={`Rendered PDF page ${pageNumber}`} style={{ width: zoom === "fit" ? "100%" : preview.width * zoom, maxWidth: zoom === "fit" ? "100%" : "none" }} /> : <div className="empty-state">Page preview is unavailable after reload. Choose the PDF again to restore page images.</div>}
      </div>
    </section>
  );
}
