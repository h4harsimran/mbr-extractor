import { useState, useCallback, useRef, useEffect } from "react";
import FileUpload from "./components/FileUpload";
import ExtractionProgress from "./components/ExtractionProgress";
import ResultsView from "./components/ResultsView";
import { loadPdf, renderPage } from "./lib/pdf-renderer";
import { extractPageFromApi } from "./lib/extraction-client";
import type {
  AppState,
  PageProgress,
  PageExtraction,
  ExtractedRow,
} from "./types";

const loadInitialState = () => {
  try {
    const saved = localStorage.getItem("mbr-session");
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to parse saved session", e);
  }
  return null;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(
    () => loadInitialState()?.appState || "upload"
  );
  const [pages, setPages] = useState<PageProgress[]>(
    () => loadInitialState()?.pages || []
  );
  const [filename, setFilename] = useState<string>(
    () => loadInitialState()?.filename || ""
  );
  const [startTime, setStartTime] = useState<number>(
    () => loadInitialState()?.startTime || 0
  );
  const abortRef = useRef(false);



  const processFile = useCallback(async (file: File) => {
    abortRef.current = false;
    setFilename(file.name);
    setAppState("processing");
    setStartTime(Date.now());

    try {
      // Load PDF and get page count
      const pdf = await loadPdf(file);
      const totalPages = pdf.numPages;

      // Initialize page progress
      const initialPages: PageProgress[] = Array.from(
        { length: totalPages },
        (_, i) => ({
          pageNumber: i + 1,
          status: "pending",
          extraction: null,
          error: null,
        })
      );
      setPages(initialPages);

      // Process pages in parallel with a concurrency limit
      const completedExtractions: PageExtraction[] = [];
      const CONCURRENCY_LIMIT = 10;
      let currentIndex = 0;

      const worker = async () => {
        while (currentIndex < totalPages) {
          if (abortRef.current) break;
          const i = currentIndex++;
          const pageNum = i + 1;

          // Update status to processing
          setPages((prev) =>
            prev.map((p) =>
              p.pageNumber === pageNum ? { ...p, status: "processing" } : p
            )
          );

          try {
            // Render page to image in browser
            const rendered = await renderPage(pdf, pageNum);

            // Send to worker for Gemini extraction
            const result = await extractPageFromApi(
              rendered.base64Image,
              pageNum
            );

            if (result.success && result.page_extraction) {
              completedExtractions.push(result.page_extraction);
              setPages((prev) =>
                prev.map((p) =>
                  p.pageNumber === pageNum
                    ? {
                        ...p,
                        status: "completed",
                        extraction: result.page_extraction,
                      }
                    : p
                )
              );
            } else {
              setPages((prev) =>
                prev.map((p) =>
                  p.pageNumber === pageNum
                    ? {
                        ...p,
                        status: "failed",
                        error: result.errors.join("; ") || "Unknown error",
                      }
                    : p
                )
              );
            }
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown error";
            setPages((prev) =>
              prev.map((p) =>
                p.pageNumber === pageNum
                  ? { ...p, status: "failed", error: message }
                  : p
              )
            );
          }
        }
      };

      const workers = Array.from(
        { length: Math.min(CONCURRENCY_LIMIT, totalPages) },
        worker
      );
      await Promise.all(workers);

      pdf.destroy();
    } catch (err) {
      console.error("PDF processing failed:", err);
      alert(
        `Failed to process PDF: ${err instanceof Error ? err.message : String(err)}`
      );
      setAppState("upload");
      return;
    }

    // Move to results
    setAppState("results");
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setAppState("upload");
    setPages([]);
    setFilename("");
  }, []);

  const handleUpdateRow = useCallback(
    (
      pageNumber: number,
      rowIndex: number,
      field: keyof ExtractedRow,
      value: string | boolean | number
    ) => {
      setPages((prev) =>
        prev.map((p) => {
          if (p.pageNumber !== pageNumber || !p.extraction) return p;
          return {
            ...p,
            extraction: {
              ...p.extraction,
              rows: p.extraction.rows.map((r, i) =>
                i === rowIndex ? { ...r, [field]: value } : r
              ),
            },
          };
        })
      );
    },
    []
  );

  useEffect(() => {
    if (appState !== "upload") {
      localStorage.setItem(
        "mbr-session",
        JSON.stringify({ appState, pages, filename, startTime })
      );
    } else {
      localStorage.removeItem("mbr-session");
    }
  }, [appState, pages, filename, startTime]);

  const completedExtractions: PageExtraction[] = pages
    .filter((p) => p.status === "completed" && p.extraction)
    .map((p) => p.extraction!);

  const failedCount = pages.filter((p) => p.status === "failed").length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">M</div>
        <h1 className="app-title">MBR Extractor</h1>
        <span className="app-subtitle">
          AI-Powered Batch Record Data Extraction
        </span>
      </header>

      <main className="app-content">
        {appState === "upload" && (
          <FileUpload onFileSelected={processFile} />
        )}

        {appState === "processing" && (
          <ExtractionProgress
            pages={pages}
            filename={filename}
            startTime={startTime}
          />
        )}

        {appState === "results" && (
          <ResultsView
            pages={completedExtractions}
            filename={filename}
            failedCount={failedCount}
            onReset={handleReset}
            onUpdateRow={handleUpdateRow}
          />
        )}
      </main>
    </div>
  );
}
