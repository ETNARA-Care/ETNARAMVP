import i18n from "@/i18n";
import type { FamilyTimelineItem } from "@/api/familyTimeline";
import { valueKey } from "./activities";

/**
 * 177 (hogares F5): título y resumen traducidos de una actividad del historial familiar, con los campos de lista cerrada
 * que envía el backend. Si un valor no tiene traducción se muestra tal cual (nunca se inventa). Una nota libre se
 * muestra como la escribió su autor.
 */
// Claves dinámicas (valor guardado → clave): se comprueba que existan antes de usarlas.
const tr = (key: string, options?: Record<string, unknown>): string => (i18n.t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, options);
const KNOWN = new Set(["MEAL", "HYDRATION", "TOILETING", "MOBILITY", "ACTIVITY", "MOOD", "NOTE", "PHOTO"]);
export function activityText(item: FamilyTimelineItem): { title: string; summary: string } {
  const type = KNOWN.has(item.type) ? item.type : "OTHER";
  const f = item.fields ?? {};
  const v = (k: string): string | null => {
    const raw = f[k];
    if (typeof raw !== "string") return null;
    const key = `residential:activities.values.${valueKey(raw)}`;
    return i18n.exists(key) ? tr(key) : raw;
  };
  const title = tr(`residential:activities.types.${type}`);
  let parts: Array<string | null> = [];
  if (type === "MEAL") parts = [v("mealType"), v("amountConsumed")];
  else if (type === "HYDRATION") parts = [v("amount")];
  else if (type === "TOILETING") parts = [v("result")];
  else if (type === "MOBILITY") parts = [v("activity")];
  else if (type === "MOOD") parts = [v("mood")];
  else if (type === "ACTIVITY") parts = [typeof f.label === "string" ? f.label : null, typeof f.durationMinutes === "number" ? tr("residential:activities.minutes", { count: f.durationMinutes }) : null];
  else if (type === "NOTE") parts = [typeof f.note === "string" ? f.note : null];
  const summary = parts.filter(Boolean).join(" · ") || tr("residential:activities.recorded");
  return { title, summary };
}

/** Puesto del autor traducido (código interno del puesto); si no se conoce, se muestra tal cual. */
export function roleText(role: string | null): string | null {
  if (!role) return null;
  const key = `residential:activities.roles.${valueKey(role)}`;
  return i18n.exists(key) ? tr(key) : role;
}
