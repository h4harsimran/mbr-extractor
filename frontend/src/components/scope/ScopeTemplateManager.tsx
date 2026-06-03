import { useEffect, useMemo, useState } from "react";
import type { ScopedExtractionPlan, ScopedExtractionTemplate } from "../../types";
import { builtInScopeTemplates } from "../../lib/builtin-scope-templates";
import { createScopedTemplate, loadScopedTemplates, saveScopedTemplates, upsertTemplate } from "../../lib/scope-template-store";
import { validateScopedExtractionPlan } from "../../lib/scope-validation";
import { resolveTemplateImportCollisions } from "../../lib/scope-template-io";
import ScopeTemplateImportExport from "./ScopeTemplateImportExport";

interface Props {
  currentScope: ScopedExtractionPlan | null;
  onLoadScope: (scope: ScopedExtractionPlan) => void;
}

export default function ScopeTemplateManager({ currentScope, onLoadScope }: Props) {
  const loaded = useMemo(() => loadScopedTemplates(), []);
  const [templates, setTemplates] = useState<ScopedExtractionTemplate[]>(loaded.templates);
  const [message, setMessage] = useState<string | null>(loaded.error);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState<string>(loaded.templates[0]?.template_id ?? builtInScopeTemplates[0]?.template_id ?? "");
  const selectedTemplate = [...templates, ...builtInScopeTemplates].find((template) => template.template_id === selectedId) ?? null;

  useEffect(() => {
    const error = saveScopedTemplates(templates);
    if (error) setMessage(error);
  }, [templates]);

  const saveCurrent = () => {
    if (!currentScope) return;
    const validation = validateScopedExtractionPlan(currentScope);
    if (!validation.valid) {
      setMessage(validation.errors.join(" "));
      return;
    }
    const template = createScopedTemplate(name || "Scoped extraction template", currentScope);
    setTemplates((prev) => upsertTemplate(prev, template));
    setSelectedId(template.template_id);
    setName("");
    setMessage("Template saved locally in this browser.");
  };

  const rename = () => {
    if (!selectedTemplate || selectedTemplate.template_id.startsWith("builtin_")) return;
    const next = window.prompt("New template name", selectedTemplate.name)?.trim();
    if (!next) return;
    setTemplates((prev) => prev.map((template) => template.template_id === selectedTemplate.template_id ? { ...template, name: next, updated_at: new Date().toISOString() } : template));
  };

  const remove = () => {
    if (!selectedTemplate || selectedTemplate.template_id.startsWith("builtin_")) return;
    setTemplates((prev) => prev.filter((template) => template.template_id !== selectedTemplate.template_id));
    setMessage("Template deleted from local browser storage.");
  };

  return (
    <div className="scope-panel" aria-label="Scoped extraction templates">
      <h3 className="scope-title">Saved templates</h3>
      <p className="upload-hint">Templates are stored only in browser localStorage. Loaded or imported templates must be approved before extraction starts.</p>
      {message && <div className="info-banner" style={{ marginBottom: 12 }}>{message}</div>}
      <div className="scope-review-row">
        <select aria-label="Saved template" className="editable-cell" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <optgroup label="Local templates">
            {templates.map((template) => <option key={template.template_id} value={template.template_id}>{template.name}</option>)}
          </optgroup>
          <optgroup label="Built-in starters">
            {builtInScopeTemplates.map((template) => <option key={template.template_id} value={template.template_id}>{template.name}</option>)}
          </optgroup>
        </select>
        <button className="btn btn-secondary" disabled={!selectedTemplate} onClick={() => selectedTemplate && onLoadScope(selectedTemplate.scope)}>Load into current scope</button>
        <button className="btn btn-secondary" disabled={!selectedTemplate || selectedTemplate.template_id.startsWith("builtin_")} onClick={rename}>Rename</button>
        <button className="btn btn-secondary" disabled={!selectedTemplate || selectedTemplate.template_id.startsWith("builtin_")} onClick={remove}>Delete</button>
      </div>
      <div className="scope-review-row" style={{ marginTop: 12 }}>
        <input aria-label="Template name" className="editable-cell" placeholder="Template name" value={name} onChange={(event) => setName(event.target.value)} />
        <button className="btn btn-success" disabled={!currentScope || !validateScopedExtractionPlan(currentScope).valid} onClick={saveCurrent}>Save current scope as template</button>
      </div>
      <ScopeTemplateImportExport
        templates={templates}
        selectedTemplate={selectedTemplate && !selectedTemplate.template_id.startsWith("builtin_") ? selectedTemplate : null}
        onImport={(imported, summary) => {
          const resolved = resolveTemplateImportCollisions(imported, templates);
          setTemplates((prev) => resolved.templates.reduce((next, template) => upsertTemplate(next, template), prev));
          setMessage(`Import summary: ${resolved.imported} imported, ${summary.skipped} skipped, ${resolved.renamed} renamed.`);
        }}
      />
    </div>
  );
}
