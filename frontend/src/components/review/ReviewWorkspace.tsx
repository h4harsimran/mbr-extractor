import { useEffect, useMemo, useState } from "react";
import type { ExtractedRow, ExtractionMode, PageExtraction, PagePreview, ReviewStatus, ScopedExtractionResult, ScopedPageExtraction } from "../../types";
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
  onUpdateScopedRow: (pageNumber: number, rowIndex: number, field: keyof ScopedExtractionResult, value: string | boolean | number | string[] | ReviewStatus | null) => void;
  onRetryPage: (pageNumber: number) => void;
}

const needsReview = (row: ReviewRow) => {
  if (row.kind === "full") return row.needs_review;
  return row.needs_review && row.review_status !== "accepted" && row.review_status !== "not_applicable";
};

const selectedParameterLabel = (row: ReviewRow) => row.kind === "full" ? row.parameter_label ?? undefined : row.display_name;
const selectedSourceLabel = (row: ReviewRow) => row.kind === "scoped" ? row.source_label ?? undefined : row.parameter_label ?? undefined;

export default function ReviewWorkspace({ mode, pages, scopedPages, previews, initialPage, initialRow = null, onUpdateFullRow, onUpdateScopedRow, onRetryPage }: Props) {
  const pageNumbers = useMemo(() => {
    const nums = mode === "scoped" ? scopedPages.map((page) => page.page_number) : pages.map((page) => page.page_number);
    return nums.length ? nums : [1];
  }, [mode, pages, scopedPages]);
  const [pageNumber, setPageNumber] = useState(initialPage && pageNumbers.includes(initialPage) ? initialPage : pageNumbers[0]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(initialRow);
  const [zoom, setZoom] = useState<"fit" | 0.75 | 1 | 1.25>("fit");
  const queueDrivenReview = initialPage !== undefined && initialRow !== null;

  useEffect(() => {
    setPageNumber(initialPage && pageNumbers.includes(initialPage) ? initialPage : pageNumbers[0]);
  }, [initialPage, pageNumbers]);

  useEffect(() => setSelectedRowIndex(initialRow), [initialRow]);

  const rowsForPage = (targetPageNumber: number): ReviewRow[] => mode === "scoped"
    ? (scopedPages.find((page) => page.page_number === targetPageNumber)?.scoped_results ?? []).map((row, rowIdx) => ({ ...row, page_number: targetPageNumber, rowIdx, kind: "scoped" as const }))
    : (pages.find((page) => page.page_number === targetPageNumber)?.rows ?? []).map((row, rowIdx) => ({ ...row, rowIdx, kind: "full" as const }));

  const rows = rowsForPage(pageNumber);
  const selectedRow = selectedRowIndex !== null ? rows.find((row) => row.rowIdx === selectedRowIndex) : undefined;

  const moveToNextReviewItem = (currentPageNumber: number, currentRowIndex: number, fallbackToCurrent: boolean) => {
    const reviewItems = pageNumbers.flatMap((targetPageNumber) => rowsForPage(targetPageNumber).filter(needsReview).map((row) => ({ pageNumber: targetPageNumber, rowIndex: row.rowIdx })));
    const currentIndex = reviewItems.findIndex((item) => item.pageNumber === currentPageNumber && item.rowIndex === currentRowIndex);
    const laterItem = reviewItems.slice(currentIndex + 1).find((item) => item.pageNumber !== currentPageNumber || item.rowIndex !== currentRowIndex);
    const earlierItem = reviewItems.slice(0, Math.max(currentIndex, 0)).find((item) => item.pageNumber !== currentPageNumber || item.rowIndex !== currentRowIndex);
    const fallbackItem = currentIndex === -1 ? reviewItems[0] : fallbackToCurrent ? reviewItems[currentIndex] : undefined;
    const nextItem = laterItem ?? earlierItem ?? fallbackItem;

    if (!nextItem) {
      setSelectedRowIndex(null);
      return;
    }

    setPageNumber(nextItem.pageNumber);
    setSelectedRowIndex(nextItem.rowIndex);
  };

  const acceptAndNext = (row: ReviewRow) => {
    if (row.kind === "full") onUpdateFullRow(pageNumber, row.rowIdx, "needs_review", false);
    else {
      onUpdateScopedRow(pageNumber, row.rowIdx, "needs_review", false);
      onUpdateScopedRow(pageNumber, row.rowIdx, "review_status", "accepted");
    }
    moveToNextReviewItem(pageNumber, row.rowIdx, false);
  };

  const skipForNow = (row: ReviewRow) => {
    moveToNextReviewItem(pageNumber, row.rowIdx, true);
  };

  useEffect(() => {
    if (selectedRowIndex !== null && !rows.some((row) => row.rowIdx === selectedRowIndex)) setSelectedRowIndex(null);
  }, [pageNumber, rows, selectedRowIndex]);

  return (
    <div className="review-workspace">
      <PagePreviewPanel
        preview={previews.find((preview) => preview.pageNumber === pageNumber)}
        pageNumber={pageNumber}
        pageNumbers={pageNumbers}
        zoom={zoom}
        selectedParameterLabel={selectedRow ? selectedParameterLabel(selectedRow) : undefined}
        selectedSourceLabel={selectedRow ? selectedSourceLabel(selectedRow) : undefined}
        onZoomChange={setZoom}
        onPageChange={(page) => { setPageNumber(page); setSelectedRowIndex(null); }}
      />
      <PageRowsPanel mode={mode} pageNumber={pageNumber} rows={rows} selectedRowIndex={selectedRowIndex} queueDrivenReview={queueDrivenReview} onSelectRow={setSelectedRowIndex} onUpdateFullRow={onUpdateFullRow} onUpdateScopedRow={onUpdateScopedRow} onRetryPage={onRetryPage} onAcceptAndNext={acceptAndNext} onSkipForNow={skipForNow} />
    </div>
  );
}
