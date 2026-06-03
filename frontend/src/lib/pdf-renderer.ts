import * as pdfjsLib from "pdfjs-dist";
import { extractionConfig } from "../config/extraction";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const renderScale = extractionConfig.renderDpi / 72;

export interface RenderedPage {
  pageNumber: number;
  base64Image: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
}

export async function loadPdf(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

export async function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<RenderedPage> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: renderScale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is unavailable in this browser.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/jpeg", extractionConfig.jpegQuality);
  const base64Image = dataUrl.split(",")[1] ?? "";
  canvas.width = 0;
  canvas.height = 0;

  return { pageNumber, base64Image, mimeType: "image/jpeg", width: viewport.width, height: viewport.height };
}
