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
  const selectedIsBuiltIn = selectedTemplate?.template_id.startsWith("builtin_") ?? false;

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
    setMessage("Template saved in this browser.");
  };

  const rename = () => {
    if (!selectedTemplate || selectedIsBuiltIn) return;
    const next = window.prompt("New template name", selectedTemplate.name)?.trim();
    if (!next) return;
    setTemplates((prev) => prev.map((template) => template.template_id === selectedTemplate.template_id ? { ...template, name: next, updated_at: new Date().toISOString() } : template));
  };

  const remove = () => {
    if (!selectedTemplate || selectedIsBuiltIn) return;
    setTemplates((prev) => prev.filter((template) => template.template_id !== selectedTemplate.template_id));
    setMessage("Template deleted from this browser.");
  };

  return (
    <div className="template-panel" aria-label="Scoped extraction templates">
      <div className="section-header compact">
        <span className="step-badge subtle">or</span>
        <div>
          <h3 className="section-title">Choose a template</h3>
          <p className="section-description">Start from saved or built-in fields instead of pasting a new list.</p>
        </div>
      </div>
      {message && <div className="callout callout-info">{message}</div>}
      <div className="template-controls">
        <select aria-label="Saved template" className="editable-cell" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          <optgroup label="Saved in this browser">
            {templates.map((template) => <option key={template.template_id} value={template.template_id}>{template.name}</option>)}
          </optgroup>
          <optgroup label="Built-in starters">
            {builtInScopeTemplates.map((template) => <option key={template.template_id} value={template.template_id}>{template.name}</option>)}
          </optgroup>
        </select>
        <button className="btn btn-secondary" disabled={!selectedTemplate} onClick={() => selectedTemplate && onLoadScope(selectedTemplate.scope)}>Use template</button>
      </div>
      <details className="advanced-details template-management-details">
        <summary>Manage templates</summary>
        <p className="helper-text">Save, rename, import, or export reusable field lists for this browser.</p>
        <div className="template-controls">
          <button className="btn btn-secondary" disabled={!selectedTemplate || selectedIsBuiltIn} onClick={rename}>Rename saved template</button>
          <button className="btn btn-secondary" disabled={!selectedTemplate || selectedIsBuiltIn} onClick={remove}>Delete saved template</button>
        </div>
        <div className="template-controls template-controls-spaced">
          <input aria-label="Template name" className="editable-cell" placeholder="Template name" value={name} onChange={(event) => setName(event.target.value)} />
          <button className="btn btn-success" disabled={!currentScope || !validateScopedExtractionPlan(currentScope).valid} onClick={saveCurrent}>Save current scope</button>
        </div>
        <ScopeTemplateImportExport
          templates={templates}
          selectedTemplate={selectedTemplate && !selectedIsBuiltIn ? selectedTemplate : null}
          onImport={(imported, summary) => {
            const resolved = resolveTemplateImportCollisions(imported, templates);
            setTemplates((prev) => resolved.templates.reduce((next, template) => upsertTemplate(next, template), prev));
            setMessage(`Import summary: ${resolved.imported} imported, ${summary.skipped} skipped, ${resolved.renamed} renamed.`);
          }}
        />
      </details>
    </div>
  );
}
