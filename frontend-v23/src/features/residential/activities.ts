import type { CareEventTypeCode } from "@/api/careEvents";

/**
 * 177 (hogares F5): actividades no clínicas que registra el cuidador para sus residentes asignados (catálogo existente
 * de eventos de cuidado). Los valores son los que acepta el backend (en español, como se guardan); el portal muestra
 * su traducción con la clave de cada valor. Ningún campo clínico.
 */
export const ACTIVITY_TYPES: CareEventTypeCode[] = ["MEAL", "HYDRATION", "TOILETING", "MOBILITY", "ACTIVITY", "MOOD", "NOTE"];
export const ACTIVITY_OPTIONS = {
  mealType: ["Desayuno", "Almuerzo", "Cena", "Snack"],
  amountConsumed: ["Poco", "Mitad", "Casi todo", "Todo"],
  amount: ["Rechazó", "Poco", "Medio vaso", "Vaso completo"],
  result: ["Sin novedad", "Asistencia parcial", "Asistencia total", "Requirió cambio"],
  activity: ["No realizada", "Caminata corta", "Caminata 15 minutos", "Con asistencia", "Silla de ruedas"],
  mood: ["Contento", "Tranquilo", "Triste", "Ansioso", "Confundido", "Irritable", "Somnoliento"],
} as const;
export type OptionField = keyof typeof ACTIVITY_OPTIONS;
/** Campos de cada tipo, en orden. */
export const TYPE_FIELDS: Record<CareEventTypeCode, Array<OptionField | "label" | "durationMinutes" | "note">> = {
  MEAL: ["mealType", "amountConsumed"], HYDRATION: ["amount"], TOILETING: ["result"], MOBILITY: ["activity"],
  ACTIVITY: ["label", "durationMinutes"], MOOD: ["mood"], NOTE: ["note"],
};
/** Clave de traducción estable para un valor guardado (sin acentos ni espacios). */
export function valueKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** Cuerpo que acepta el backend para cada tipo (o null si falta algo obligatorio). */
export function activityInput(type: CareEventTypeCode, values: Record<string, string>): { payload?: Record<string, unknown>; noteText?: string } | null {
  const note = (values.note ?? "").trim();
  const opt = (f: OptionField) => ((ACTIVITY_OPTIONS[f] as readonly string[]).includes(values[f] ?? "") ? values[f] : null);
  const withNote = (payload: Record<string, unknown>) => ({ payload, ...(note && type !== "NOTE" ? { noteText: note } : {}) });
  switch (type) {
    case "MEAL": { const a = opt("mealType"), b = opt("amountConsumed"); return a && b ? withNote({ mealType: a, amountConsumed: b }) : null; }
    case "HYDRATION": { const a = opt("amount"); return a ? withNote({ amount: a }) : null; }
    case "TOILETING": { const a = opt("result"); return a ? withNote({ result: a }) : null; }
    case "MOBILITY": { const a = opt("activity"); return a ? withNote({ activity: a }) : null; }
    case "MOOD": { const a = opt("mood"); return a ? withNote({ mood: a }) : null; }
    case "ACTIVITY": {
      const label = (values.label ?? "").trim();
      const minutes = Number.parseInt(values.durationMinutes ?? "", 10);
      if (!label || label.length > 200) return null;
      return withNote({ label, ...(Number.isFinite(minutes) && minutes > 0 && minutes <= 1440 ? { durationMinutes: minutes } : {}) });
    }
    case "NOTE": return note ? { noteText: note.slice(0, 4000) } : null;
    default: return null;
  }
}
