import type { FamilyTimelineItem } from "@/api/familyTimeline";

export interface DailySummaryLine {
  label: string;
  text: string;
}

/**
 * Resume las actualizaciones de hoy en frases cortas para la familia.
 *
 * Solo usa lo que el equipo registró en el contrato curado de Familia: no
 * interpreta ni califica el día, y omite las categorías sin
 * registros. Los registros de baño no se resumen por dignidad; siguen visibles
 * en la actividad detallada si la agencia los comparte.
 */
export function buildDailySummary(items: FamilyTimelineItem[]): DailySummaryLine[] {
  const ofType = (type: string) => items.filter((item) => item.type === type);
  const lines: DailySummaryLine[] = [];

  const meals = ofType("MEAL").slice().reverse().map((item) => {
    const [kind, amount] = item.summary.split(" · ");
    return amount ? `${kind}: ${amount.toLowerCase()}` : kind;
  });
  if (meals.length) lines.push({ label: "Comidas", text: meals.join(", ") });

  const hydration = ofType("HYDRATION").length;
  if (hydration) lines.push({ label: "Líquidos", text: hydration === 1 ? "Tomó líquidos 1 vez" : `Tomó líquidos ${hydration} veces` });

  const movement = Array.from(new Set(
    items.filter((item) => item.type === "MOBILITY" || item.type === "ACTIVITY").slice().reverse().map((item) => item.summary),
  ));
  if (movement.length) lines.push({ label: "Movimiento", text: movement.join(", ") });

  const mood = ofType("MOOD")[0];
  if (mood) lines.push({ label: "Ánimo", text: mood.summary });

  return lines;
}
