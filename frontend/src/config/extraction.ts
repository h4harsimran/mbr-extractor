export const extractionConfig = {
  renderDpi: 180,
  jpegQuality: 0.72,
  maxPages: 40,
  maxFileSizeMb: 25,
  concurrency: 3,
} as const;

export function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}
