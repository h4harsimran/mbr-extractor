// ── PDF to image rendering using pdf.js ────────────────────────────

import * as pdfjsLib from "pdfjs-dist";

// Configure the worker — use CDN for the worker script
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const RENDER_SCALE = 200 / 72; // 200 DPI (72 is default PDF DPI)

export interface RenderedPage {
  pageNumber: number;
  base64Image: string; // base64 PNG without data URI prefix
  width: number;
  height: number;
}

/**
 * Load a PDF from a File object and return total page count.
 */
export async function loadPdf(
  file: File
): Promise<pdfjsLib.PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf;
}

/**
 * Render a single PDF page to a base64 PNG image.
 * Uses an off-screen canvas to avoid DOM pollution.
 */
export async function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  // Create off-screen canvas
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // Get base64 — strip the "data:image/png;base64," prefix
  const dataUrl = canvas.toDataURL("image/png");
  const base64Image = dataUrl.split(",")[1];

  // Clean up
  canvas.width = 0;
  canvas.height = 0;

  return {
    pageNumber,
    base64Image,
    width: viewport.width,
    height: viewport.height,
  };
}
