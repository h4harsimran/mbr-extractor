import { useRef, useState } from "react";
import type { ScopedExtractionTemplate } from "../../types";
import { downloadJson, exportAllScopedTemplates, exportScopedTemplate, parseTemplateImport, type TemplateImportSummary } from "../../lib/scope-template-io";

interface Props {
  templates: ScopedExtractionTemplate[];
  selectedTemplate: ScopedExtractionTemplate | null;
  onImport: (templates: ScopedExtractionTemplate[], summary: TemplateImportSummary) => void;
}

const MAX_IMPORT_BYTES = 1024 * 1024;

export default function ScopeTemplateImportExport({ templates, selectedTemplate, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<TemplateImportSummary | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setSummary({ templates: [], imported: 0, skipped: 1, renamed: 0, errors: ["Template import file is too large. Maximum size is 1 MB."] });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    let text: string;
    try { text = await file.text(); } catch { setSummary({ templates: [], imported: 0, skipped: 1, renamed: 0, errors: ["Template import file could not be read."] }); return; }
    const result = parseTemplateImport(text);
    setSummary(result);
    if (result.templates.length > 0 && result.imported > 0) onImport(result.templates, result);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="template-io" aria-label="Template import and export">
      <div className="results-actions">
        <button className="btn btn-secondary" disabled={!selectedTemplate} onClick={() => selectedTemplate && downloadJson(exportScopedTemplate(selectedTemplate), `${selectedTemplate.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-template.json`)}>Export selected template</button>
        <button className="btn btn-secondary" disabled={templates.length === 0} onClick={() => downloadJson(exportAllScopedTemplates(templates), "mbr-scoped-templates.json")}>Export all templates</button>
        <input ref={inputRef} aria-label="Import template JSON" type="file" accept="application/json,.json" onChange={(event) => void handleFile(event.target.files?.[0])} />
      </div>
      {summary && (
        <div className="error-banner" style={{ marginTop: 12, borderColor: summary.errors.length ? "var(--warning)" : "var(--success)", color: summary.errors.length ? "var(--warning)" : "var(--success)" }}>
          Import summary: {summary.imported} imported, {summary.skipped} skipped, {summary.renamed} renamed.
          {summary.errors.length > 0 && <ul>{summary.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
