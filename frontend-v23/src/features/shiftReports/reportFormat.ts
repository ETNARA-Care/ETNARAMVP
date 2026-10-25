/** Shared formatting for shift reports (Puerto Rico time, es-PR). */
const TZ = "America/Puerto_Rico";
export const reportTime = (v: string) => new Date(v).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: TZ });
export const reportDate = (v: string) => new Date(v).toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });

export const STATUS_LABEL: Record<string, { text: string; tone: "neutral" | "success" | "warning" | "accent" }> = {
  DRAFT: { text: "Borrador", tone: "warning" },
  SUBMITTED: { text: "En revisión", tone: "accent" },
  RETURNED: { text: "Devuelto", tone: "neutral" },
  APPROVED: { text: "Aprobado", tone: "success" },
  SUPERSEDED: { text: "Reemplazado", tone: "neutral" },
};
