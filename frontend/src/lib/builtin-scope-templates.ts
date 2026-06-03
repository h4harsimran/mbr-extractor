import type { ScopedExtractionTemplate } from "../types";

const now = "2026-06-03T00:00:00.000Z";
const make = (template_id: string, name: string, parameters: Array<[string, string, string[], string[]]>): ScopedExtractionTemplate => ({
  template_version: 1,
  template_id,
  name,
  description: "Starter template. Review and edit before use; not regulatory-complete.",
  created_at: now,
  updated_at: now,
  scope: {
    scope_version: 1,
    document_type: "master_batch_record",
    extraction_mode: "scoped",
    parameters: parameters.map(([parameter_id, display_name, expected_units, synonyms]) => ({
      parameter_id,
      display_name,
      description: `Extract ${display_name} when present in the MBR page.`,
      expected_units,
      synonyms,
      value_types: ["target_value", "actual_value"],
      required_evidence: ["page_number", "source_label", "nearby_text"],
      needs_review_rules: ["missing_actual_value", "unit_mismatch", "low_confidence"],
    })),
  },
});

export const builtInScopeTemplates: ScopedExtractionTemplate[] = [
  make("builtin_generic_mbr_critical_parameters", "Generic MBR Critical Parameters", [["temperature", "Temperature", ["°C", "C"], ["temp"]], ["ph", "pH", [], ["acidity"]], ["mixing_speed", "Mixing speed", ["rpm"], ["agitation"]]]),
  make("builtin_cell_therapy_cpps", "Cell Therapy CPPs", [["cell_density", "Cell density", ["cells/mL"], ["viable cell density"]], ["viability", "Viability", ["%"], ["cell viability"]], ["culture_temperature", "Culture temperature", ["°C"], ["incubation temperature"]]]),
  make("builtin_ipc_testing", "IPC / In-process Testing", [["ipc_result", "IPC result", [], ["in-process control"]], ["sample_time", "Sample time", [], ["sampling time"]], ["acceptance_criteria", "Acceptance criteria", [], ["specification"]]]),
  make("builtin_equipment_setup", "Equipment Setup Parameters", [["equipment_id", "Equipment ID", [], ["equipment number"]], ["setpoint", "Setpoint", [], ["target setting"]], ["calibration_status", "Calibration status", [], ["cal status"]]]),
];
