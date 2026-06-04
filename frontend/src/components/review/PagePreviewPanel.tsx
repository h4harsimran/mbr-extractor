import type { CSSProperties } from "react";
import type { PagePreview } from "../../types";

interface Props {
  preview?: PagePreview;
  pageNumber: number;
  pageNumbers: number[];
  zoom: "fit" | 0.75 | 1 | 1.25;
  selectedParameterLabel?: string;
  selectedSourceLabel?: string;
  onZoomChange: (zoom: "fit" | 0.75 | 1 | 1.25) => void;
  onPageChange: (pageNumber: number) => void;
}

export default function PagePreviewPanel({ preview, pageNumber, pageNumbers, zoom, selectedParameterLabel, selectedSourceLabel, onZoomChange, onPageChange }: Props) {
  const previewStyle = preview && zoom !== "fit" ? ({ width: `${preview.width * zoom}px` } as CSSProperties) : undefined;
  const selectedContext = [selectedParameterLabel, selectedSourceLabel ? `Source: ${selectedSourceLabel}` : undefined].filter(Boolean).join(" · ");
  return (
    <section className="review-preview-panel" aria-label="PDF page preview">
      <div className="review-toolbar">
        <button className="btn btn-secondary" disabled={pageNumbers.indexOf(pageNumber) <= 0} onClick={() => onPageChange(pageNumbers[Math.max(0, pageNumbers.indexOf(pageNumber) - 1)])}>Previous page</button>
        <strong>Page {pageNumber}</strong>
        <button className="btn btn-secondary" disabled={pageNumbers.indexOf(pageNumber) === pageNumbers.length - 1} onClick={() => onPageChange(pageNumbers[Math.min(pageNumbers.length - 1, pageNumbers.indexOf(pageNumber) + 1)])}>Next page</button>
      </div>
      <div className="review-toolbar" aria-label="Zoom controls">
        {["fit", 0.75, 1, 1.25].map((item) => <button key={String(item)} className={`btn btn-secondary ${zoom === item ? "active" : ""}`} onClick={() => onZoomChange(item as "fit" | 0.75 | 1 | 1.25)}>{item === "fit" ? "Fit width" : `${Number(item) * 100}%`}</button>)}
      </div>
      <p className="upload-hint">
        Use the page image to verify the selected value against the nearby text.
        {selectedContext ? <span> Selected: {selectedContext}.</span> : null}
      </p>
      <div className="page-preview-frame">
        {preview ? <img className={zoom === "fit" ? "page-preview-image fit" : "page-preview-image fixed"} src={preview.dataUrl} alt={`Rendered PDF page ${pageNumber}`} style={previewStyle} /> : <div className="empty-state">Page preview is unavailable after reload. Re-upload the same PDF to restore page previews.</div>}
      </div>
    </section>
  );
}
