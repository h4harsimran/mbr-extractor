import type { ScopedExtractionPlan, ScopedExtractionTemplate } from "../types";
import { sanitizeScopedExtractionPlan, validateScopedExtractionPlan } from "./scope-validation";

export const TEMPLATE_STORAGE_KEY = "mbr-scoped-templates:v1";

export interface TemplateLoadResult {
  templates: ScopedExtractionTemplate[];
  error: string | null;
}

const SAFE_TEMPLATE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createScopedTemplate(name: string, scope: ScopedExtractionPlan, description = ""): ScopedExtractionTemplate {
  const now = new Date().toISOString();
  return { template_version: 1, template_id: id(), name: name.trim() || "Untitled template", description: description.trim() || undefined, created_at: now, updated_at: now, scope };
}

export function sanitizeScopedTemplate(value: unknown): ScopedExtractionTemplate | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Partial<ScopedExtractionTemplate>;
  if (raw.template_version !== 1) return null;
  if (typeof raw.template_id !== "string" || !SAFE_TEMPLATE_ID_RE.test(raw.template_id)) return null;
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) return null;
  if (typeof raw.created_at !== "string" || Number.isNaN(Date.parse(raw.created_at))) return null;
  if (typeof raw.updated_at !== "string" || Number.isNaN(Date.parse(raw.updated_at))) return null;
  if (!validateScopedExtractionPlan(raw.scope).valid) return null;
  const scope = sanitizeScopedExtractionPlan(raw.scope);
  if (!scope) return null;
  return {
    template_version: 1,
    template_id: raw.template_id,
    name: raw.name.trim().slice(0, 120),
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim().slice(0, 500) : undefined,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    scope,
  };
}

export function loadScopedTemplates(storage: Storage = localStorage): TemplateLoadResult {
  try {
    const raw = storage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return { templates: [], error: null };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { templates: [], error: "Saved templates were corrupted and were ignored." };
    return { templates: parsed.map(sanitizeScopedTemplate).filter((t): t is ScopedExtractionTemplate => Boolean(t)), error: null };
  } catch {
    return { templates: [], error: "Saved templates could not be loaded. localStorage may be unavailable or corrupted." };
  }
}

export function saveScopedTemplates(templates: ScopedExtractionTemplate[], storage: Storage = localStorage): string | null {
  try {
    const safe = templates.map(sanitizeScopedTemplate).filter((t): t is ScopedExtractionTemplate => Boolean(t));
    storage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(safe));
    return null;
  } catch {
    return "Templates could not be saved. localStorage may be unavailable or full.";
  }
}

export function upsertTemplate(templates: ScopedExtractionTemplate[], template: ScopedExtractionTemplate): ScopedExtractionTemplate[] {
  const now = new Date().toISOString();
  const safe = sanitizeScopedTemplate({ ...template, updated_at: now });
  if (!safe) return templates;
  const existing = templates.filter((item) => item.template_id !== safe.template_id);
  return [...existing, safe];
}
