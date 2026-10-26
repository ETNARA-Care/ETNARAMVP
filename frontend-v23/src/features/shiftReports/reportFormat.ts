/** Shared formatting for shift reports (Puerto Rico time, es-PR). */
const TZ = "America/Puerto_Rico";
/** Non-breaking spaces: «2:22 p. m.» never splits across lines. */
const keep = (s: string) => s.replace(/[\s\u202f]+/g, "\u00a0");
export const reportTime = (v: string) => keep(new Date(v).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: TZ }));
export const reportDate = (v: string) => new Date(v).toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
/** Compact date for cards and narrow columns: «dom, 25 oct 2026». */
export const reportShortDate = (v: string) =>
  new Date(v).toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ }).replace(/\.(?=\s|,|$)/g, "");
/** «23 oct» — shown next to a time that falls on another day than the shift. */
export const reportDayMonth = (v: string) => keep(new Date(v).toLocaleDateString("es-PR", { day: "numeric", month: "short", timeZone: TZ }).replace(/\./g, ""));
/** Puerto Rico calendar day (YYYY-MM-DD) of an instant. */
export const reportDayKey = (v: string) => new Date(v).toLocaleDateString("en-CA", { timeZone: TZ });
/** The date to show under a time, only when it is not the shift's scheduled day (null otherwise). */
export const otherDay = (at: string, refDay?: string | null) => (refDay && reportDayKey(at) !== refDay ? reportDayMonth(at) : null);

export const STATUS_LABEL: Record<string, { text: string; tone: "neutral" | "success" | "warning" | "accent" }> = {
  DRAFT: { text: "Borrador", tone: "warning" },
  SUBMITTED: { text: "En revisión", tone: "accent" },
  RETURNED: { text: "Devuelto", tone: "neutral" },
  APPROVED: { text: "Aprobado", tone: "success" },
  SUPERSEDED: { text: "Reemplazado", tone: "neutral" },
};
