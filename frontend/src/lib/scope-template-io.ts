import type { ScopedExtractionTemplate } from "../types";
import { sanitizeScopedTemplate } from "./scope-template-store";

export interface TemplateImportSummary {
  templates: ScopedExtractionTemplate[];
  imported: number;
  skipped: number;
  errors: string[];
}

export function exportScopedTemplate(template: ScopedExtractionTemplate): string {
  return JSON.stringify(template, null, 2);
}

export function exportAllScopedTemplates(templates: ScopedExtractionTemplate[]): string {
  return JSON.stringify({ export_version: 1, exported_at: new Date().toISOString(), templates }, null, 2);
}

export function parseTemplateImport(text: string): TemplateImportSummary {
  const errors: string[] = [];
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { templates: [], imported: 0, skipped: 1, errors: ["Import file must be valid JSON."] }; }
  const candidates = Array.isArray((parsed as { templates?: unknown }).templates) ? (parsed as { templates: unknown[] }).templates : [parsed];
  const templates: ScopedExtractionTemplate[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  candidates.forEach((candidate, index) => {
    const safe = sanitizeScopedTemplate(candidate);
    if (!safe) {
      skipped += 1;
      errors.push(`Template ${index + 1} failed validation.`);
      return;
    }
    if (seen.has(safe.template_id)) {
      skipped += 1;
      errors.push(`Template ${index + 1} has a duplicate template_id in the import.`);
      return;
    }
    seen.add(safe.template_id);
    templates.push(safe);
  });
  return { templates, imported: templates.length, skipped, errors };
}

export function downloadJson(text: string, filename: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
