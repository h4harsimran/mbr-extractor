import { useMemo, useState } from "react";
import type { ExtractedRow, ExtractionMode, PageExtraction, PagePreview, ScopedExtractionResult, ScopedPageExtraction } from "../../types";
import PagePreviewPanel from "./PagePreviewPanel";
import PageRowsPanel, { type ReviewRow } from "./PageRowsPanel";

interface Props {
  mode: ExtractionMode;
  pages: PageExtraction[];
  scopedPages: ScopedPageExtraction[];
  previews: PagePreview[];
  initialPage?: number;
  initialRow?: number | null;
  onUpdateFullRow: (pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean | number) => void;
  onUpdateScopedRow: (pageNumber: number, rowIndex: number, field: keyof ScopedExtractionResult, value: string | boolean | number | string[] | null) => void;
  onRetryPage: (pageNumber: number) => void;
}

export default function ReviewWorkspace({ mode, pages, scopedPages, previews, initialPage, initialRow = null, onUpdateFullRow, onUpdateScopedRow, onRetryPage }: Props) {
  const pageNumbers = useMemo(() => {
    const nums = mode === "scoped" ? scopedPages.map((page) => page.page_number) : pages.map((page) => page.page_number);
    return nums.length ? nums : [1];
  }, [mode, pages, scopedPages]);
  const [pageNumber, setPageNumber] = useState(initialPage ?? pageNumbers[0]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(initialRow);
  const [zoom, setZoom] = useState<"fit" | 0.75 | 1 | 1.25>("fit");
  const rows: ReviewRow[] = mode === "scoped"
    ? (scopedPages.find((page) => page.page_number === pageNumber)?.scoped_results ?? []).map((row, rowIdx) => ({ ...row, page_number: pageNumber, rowIdx, kind: "scoped" as const }))
    : (pages.find((page) => page.page_number === pageNumber)?.rows ?? []).map((row, rowIdx) => ({ ...row, rowIdx, kind: "full" as const }));
  return (
    <div className="review-workspace">
      <PagePreviewPanel preview={previews.find((preview) => preview.pageNumber === pageNumber)} pageNumber={pageNumber} pageNumbers={pageNumbers} zoom={zoom} onZoomChange={setZoom} onPageChange={(page) => { setPageNumber(page); setSelectedRowIndex(null); }} />
      <PageRowsPanel mode={mode} pageNumber={pageNumber} rows={rows} selectedRowIndex={selectedRowIndex} onSelectRow={setSelectedRowIndex} onUpdateFullRow={onUpdateFullRow} onUpdateScopedRow={onUpdateScopedRow} onRetryPage={onRetryPage} />
    </div>
  );
}
