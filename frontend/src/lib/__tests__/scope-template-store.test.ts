import { describe, expect, it } from "vitest";
import { createScopedTemplate, loadScopedTemplates, saveScopedTemplates, TEMPLATE_STORAGE_KEY } from "../scope-template-store";
import { exportAllScopedTemplates, exportScopedTemplate, parseTemplateImport, resolveTemplateImportCollisions } from "../scope-template-io";

const scope = { scope_version: 1 as const, document_type: "master_batch_record" as const, extraction_mode: "scoped" as const, parameters: [{ parameter_id: "ph", display_name: "pH", description: "Extract pH.", expected_units: [], synonyms: [], value_types: ["actual_value" as const], required_evidence: ["page_number" as const, "source_label" as const, "nearby_text" as const], needs_review_rules: [] }] };

describe("scope template storage and IO", () => {
  it("saves and loads templates from localStorage", () => {
    localStorage.clear();
    const template = createScopedTemplate("Cell Therapy CPPs", scope);
    expect(saveScopedTemplates([template])).toBeNull();
    expect(loadScopedTemplates().templates[0].name).toBe("Cell Therapy CPPs");
  });

  it("exports and imports a valid single template", () => {
    const template = createScopedTemplate("Exported", scope);
    const imported = parseTemplateImport(exportScopedTemplate(template));
    expect(imported.imported).toBe(1);
    expect(imported.templates[0].name).toBe("Exported");
  });

  it("imports a valid export bundle", () => {
    const template = createScopedTemplate("Bundle", scope);
    const imported = parseTemplateImport(exportAllScopedTemplates([template]));
    expect(imported.imported).toBe(1);
    expect(imported.templates[0].template_id).toBe(template.template_id);
  });

  it("renames colliding imported templates without overwriting the existing template", () => {
    const existing = createScopedTemplate("Local", scope);
    const imported = { ...existing, name: "Imported copy" };
    const result = resolveTemplateImportCollisions([imported], [existing]);
    expect(result.renamed).toBe(1);
    expect(result.templates[0].template_id).not.toBe(existing.template_id);
    expect(result.templates[0].name).toBe("Imported copy (imported)");
    expect(existing.name).toBe("Local");
  });

  it("rejects invalid imported templates and duplicate parameter IDs", () => {
    expect(parseTemplateImport("{}").skipped).toBe(1);
    const template = createScopedTemplate("Bad", { ...scope, parameters: [scope.parameters[0], scope.parameters[0]] });
    expect(parseTemplateImport(JSON.stringify(template)).imported).toBe(0);
  });

  it("does not crash on corrupted localStorage", () => {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, "not json");
    const result = loadScopedTemplates();
    expect(result.templates).toEqual([]);
    expect(result.error).toContain("could not be loaded");
  });
});
