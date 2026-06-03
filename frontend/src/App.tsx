import { useCallback, useEffect, useRef, useState } from "react";
import FileUpload from "./components/FileUpload";
import ExtractionProgress from "./components/ExtractionProgress";
import ResultsView from "./components/ResultsView";
import UploadPreflight from "./components/UploadPreflight";
import { bytesToMb, extractionConfig } from "./config/extraction";
import { buildScopeFromApi, extractPageFromApi } from "./lib/extraction-client";
import { loadPdf, renderPage } from "./lib/pdf-renderer";
import type { AppState, ExtractedRow, ExtractionMode, PageExtraction, PagePreview, PageProgress, ReviewStatus, ScopedExtractionPlan, ScopedExtractionResult, ScopedPageExtraction, UploadPreflight as UploadPreflightData } from "./types";
import { validateScopedExtractionPlan } from "./lib/scope-validation";

const SESSION_KEY = "mbr-session";

const loadInitialState = () => {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to parse saved session", e);
  }
  return null;
};

export default function App() {
  const saved = loadInitialState();
  const [appState, setAppState] = useState<AppState>(() => saved?.appState || "upload");
  const [pages, setPages] = useState<PageProgress[]>(() => saved?.pages || []);
  const [filename, setFilename] = useState<string>(() => saved?.filename || "");
  const [startTime, setStartTime] = useState<number>(() => saved?.startTime || 0);
  const [preflight, setPreflight] = useState<UploadPreflightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>(() => saved?.extractionMode || "full");
  const [rawParameters, setRawParameters] = useState<string>(() => saved?.rawParameters || "");
  const [documentContext, setDocumentContext] = useState<string>(() => saved?.documentContext || "");
  const [scopedPlan, setScopedPlan] = useState<ScopedExtractionPlan | null>(() => saved?.scopedPlan || null);
  const [scopeApproved, setScopeApproved] = useState<boolean>(() => saved?.scopeApproved || false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeWarnings, setScopeWarnings] = useState<string[]>([]);
  const [pagePreviews, setPagePreviews] = useState<PagePreview[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const initializePages = (totalPages: number): PageProgress[] =>
    Array.from({ length: totalPages }, (_, i) => ({
      pageNumber: i + 1,
      status: "pending",
      extraction: null,
      scopedExtraction: null,
      error: null,
    }));

  const prepareFile = useCallback(async (file: File) => {
    setError(null);
    setInfoMessage(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    if (bytesToMb(file.size) > extractionConfig.maxFileSizeMb) {
      setError(`File is too large. Maximum size is ${extractionConfig.maxFileSizeMb} MB.`);
      return;
    }

    let pdf;
    try {
      pdf = await loadPdf(file);
      if (pdf.numPages > extractionConfig.maxPages) {
        setError(`PDF has ${pdf.numPages} pages. Maximum supported page count is ${extractionConfig.maxPages}.`);
        return;
      }
      setPreflight({ file, filename: file.name, fileSizeBytes: file.size, pageCount: pdf.numPages });
      setFilename(file.name);
      setAppState("preflight");
    } catch (err) {
      setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      pdf?.destroy();
    }
  }, []);

  const processPages = useCallback(async (targetPages?: number[]) => {
    if (!preflight?.file) {
      setError("Please choose the PDF again before retrying pages.");
      setAppState("upload");
      return;
    }

    if (extractionMode === "scoped" && (!scopeApproved || !scopedPlan || !validateScopedExtractionPlan(scopedPlan).valid)) {
      setError("Approve a valid scoped extraction plan before starting scoped extraction.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError(null);
    setFilename(preflight.filename);
    setAppState("processing");
    setStartTime(Date.now());

    const pageNumbers = targetPages ?? Array.from({ length: preflight.pageCount }, (_, i) => i + 1);
    if (!targetPages) {
      setPages(initializePages(preflight.pageCount));
      setPagePreviews([]);
    } else {
      setPages((prev) =>
        prev.map((page) =>
          pageNumbers.includes(page.pageNumber)
            ? { ...page, status: "pending", error: null, extraction: null, scopedExtraction: null }
            : page
        )
      );
    }

    let pdf;
    try {
      pdf = await loadPdf(preflight.file);
      let currentIndex = 0;
      const worker = async () => {
        while (currentIndex < pageNumbers.length && !controller.signal.aborted) {
          const pageNum = pageNumbers[currentIndex++];
          setPages((prev) => prev.map((p) => (p.pageNumber === pageNum ? { ...p, status: "processing" } : p)));
          try {
            const rendered = await renderPage(pdf!, pageNum);
            setPagePreviews((prev) => [...prev.filter((preview) => preview.pageNumber !== pageNum), { pageNumber: pageNum, dataUrl: rendered.dataUrl, width: rendered.width, height: rendered.height }].sort((a, b) => a.pageNumber - b.pageNumber));
            if (controller.signal.aborted) throw new DOMException("Extraction cancelled", "AbortError");
            const result = await extractPageFromApi(rendered.base64Image, pageNum, extractionMode, rendered.mimeType, controller.signal, extractionMode === "scoped" ? scopedPlan ?? undefined : undefined);
            if (result.success && (result.page_extraction || result.scoped_page_extraction)) {
              setPages((prev) =>
                prev.map((p) =>
                  p.pageNumber === pageNum
                    ? { ...p, status: "completed", extraction: result.page_extraction, scopedExtraction: result.scoped_page_extraction ?? null, error: null }
                    : p
                )
              );
            } else {
              setPages((prev) =>
                prev.map((p) =>
                  p.pageNumber === pageNum
                    ? { ...p, status: result.errors[0]?.code === "CANCELLED" ? "cancelled" : "failed", error: result.errors.map((item) => item.message).join("; ") || "Extraction failed" }
                    : p
                )
              );
            }
          } catch (err) {
            const cancelled = err instanceof DOMException && err.name === "AbortError";
            setPages((prev) =>
              prev.map((p) =>
                p.pageNumber === pageNum
                  ? { ...p, status: cancelled ? "cancelled" : "failed", error: cancelled ? "Extraction cancelled" : err instanceof Error ? err.message : "Unknown error" }
                  : p
              )
            );
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(extractionConfig.concurrency, pageNumbers.length) }, worker));
    } catch (err) {
      setError(`Failed to process PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      pdf?.destroy();
      abortControllerRef.current = null;
      setAppState("results");
    }
  }, [preflight, extractionMode, scopedPlan, scopeApproved]);

  const handleCancelExtraction = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort();
    setAppState("upload");
    setPages([]);
    setFilename("");
    setPreflight(null);
    setError(null);
    setInfoMessage(null);
    setExtractionMode("full");
    setRawParameters("");
    setDocumentContext("");
    setScopedPlan(null);
    setScopeApproved(false);
    setScopeWarnings([]);
    setPagePreviews([]);
  }, []);

  const handleUpdateRow = useCallback((pageNumber: number, rowIndex: number, field: keyof ExtractedRow, value: string | boolean | number) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageNumber !== pageNumber || !p.extraction) return p;
        return {
          ...p,
          extraction: {
            ...p.extraction,
            rows: p.extraction.rows.map((r, i) =>
              i === rowIndex ? { ...r, [field]: value, edited_by_user: true, needs_review: field === "needs_review" ? Boolean(value) : r.needs_review } : r
            ),
          },
        };
      })
    );
  }, []);

  const handleUpdateScopedRow = useCallback((pageNumber: number, rowIndex: number, field: keyof ScopedExtractionResult, value: string | boolean | number | string[] | ReviewStatus | null) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageNumber !== pageNumber || !p.scopedExtraction) return p;
        return {
          ...p,
          scopedExtraction: {
            ...p.scopedExtraction,
            scoped_results: p.scopedExtraction.scoped_results.map((r, i) =>
              i === rowIndex ? { ...r, [field]: value, edited_by_user: true, needs_review: field === "needs_review" ? Boolean(value) : r.needs_review, review_status: field === "needs_review" ? (value ? "open" : "accepted") : field === "review_status" ? value as ReviewStatus : r.review_status } : r
            ),
          },
        };
      })
    );
  }, []);

  const handleBuildScope = useCallback(async () => {
    setScopeLoading(true);
    setError(null);
    setInfoMessage(null);
    setScopeWarnings([]);
    try {
      const response = await buildScopeFromApi(rawParameters, documentContext);
      if (response.success && response.scope) {
        setScopedPlan(response.scope);
        setScopeApproved(false);
        setScopeWarnings(response.warnings ?? []);
      } else {
        setError(response.error?.message ?? "Failed to build extraction scope.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build extraction scope.");
    } finally {
      setScopeLoading(false);
    }
  }, [rawParameters, documentContext]);

  const handleScopeChange = useCallback((scope: ScopedExtractionPlan) => {
    setScopedPlan(scope);
    setScopeApproved(false);
  }, []);

  const handleApproveScope = useCallback(() => {
    const validation = validateScopedExtractionPlan(scopedPlan);
    if (!validation.valid) {
      setError(validation.errors.join(" "));
      setScopeApproved(false);
      return;
    }
    setError(null);
    setInfoMessage(null);
    setScopeApproved(true);
  }, [scopedPlan]);

  const handleLoadTemplateScope = useCallback((scope: ScopedExtractionPlan) => {
    setScopedPlan(scope);
    setScopeApproved(false);
    setError(null);
    setInfoMessage("Template loaded. Review and approve it before starting extraction.");
  }, []);

  useEffect(() => {
    // Page previews contain rendered PDF images/data URLs and are intentionally excluded from session persistence.
    // They stay in React memory only so reload/restore never writes page images, base64, or data URLs to localStorage.
    if (appState !== "upload") {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ appState, pages, filename, startTime, extractionMode, rawParameters, documentContext, scopedPlan, scopeApproved }));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [appState, pages, filename, startTime, extractionMode, rawParameters, documentContext, scopedPlan, scopeApproved]);

  const completedExtractions: PageExtraction[] = pages.filter((p) => p.status === "completed" && p.extraction).map((p) => p.extraction!);
  const completedScopedExtractions: ScopedPageExtraction[] = pages.filter((p) => p.status === "completed" && p.scopedExtraction).map((p) => p.scopedExtraction!);
  const failedPages = pages.filter((p) => p.status === "failed");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">M</div>
        <h1 className="app-title">MBR Extractor</h1>
        <span className="app-subtitle">AI-assisted Batch Record Data Extraction</span>
      </header>

      <main className="app-content">
        {appState === "upload" && <FileUpload onFileSelected={prepareFile} error={error} />}
        {infoMessage && <div className="info-banner">{infoMessage}</div>}
        {appState === "preflight" && preflight && (
          <UploadPreflight
            preflight={preflight}
            extractionMode={extractionMode}
            rawParameters={rawParameters}
            documentContext={documentContext}
            scopedPlan={scopedPlan}
            scopeApproved={scopeApproved}
            scopeLoading={scopeLoading}
            scopeWarnings={scopeWarnings}
            onModeChange={(mode) => { setExtractionMode(mode); setScopeApproved(false); }}
            onRawParametersChange={(value) => { setRawParameters(value); setScopeApproved(false); }}
            onDocumentContextChange={setDocumentContext}
            onBuildScope={handleBuildScope}
            onScopeChange={handleScopeChange}
            onApproveScope={handleApproveScope}
            onLoadTemplateScope={handleLoadTemplateScope}
            onStart={() => processPages()}
            onCancel={handleReset}
          />
        )}
        {appState === "processing" && (
          <ExtractionProgress pages={pages} filename={filename} startTime={startTime} onCancel={handleCancelExtraction} />
        )}
        {appState === "results" && (
          <ResultsView
            pages={completedExtractions}
            scopedPages={completedScopedExtractions}
            extractionMode={extractionMode}
            allPages={pages}
            filename={filename}
            failedCount={failedPages.length}
            onReset={handleReset}
            onUpdateRow={handleUpdateRow}
            onUpdateScopedRow={handleUpdateScopedRow}
            pagePreviews={pagePreviews}
            onRetryPage={(pageNumber) => processPages([pageNumber])}
            onRetryFailed={() => processPages(failedPages.map((page) => page.pageNumber))}
          />
        )}
      </main>
    </div>
  );
}
