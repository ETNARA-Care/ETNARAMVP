import type { OperationalAlert, OperationalCategory } from "@/api/operations";

/** Los cuatro pilares de ETNARA aplicados a las categorías reales del Centro operacional. */
export const categoryPillar: Record<OperationalCategory, "Compliance" | "Workforce" | "Care"> = {
 uncovered_shift: "Workforce",
 missed_check_in: "Workforce",
 pending_timesheet: "Workforce",
 expiring_credential: "Compliance",
 open_incident: "Care",
};

export const categoryAction: Record<OperationalCategory, string> = {
 uncovered_shift: "Asignar cuidador",
 missed_check_in: "Revisar llegada",
 pending_timesheet: "Revisar horas",
 expiring_credential: "Revisar credencial",
 open_incident: "Revisar incidente",
};

const severityRank = { critical: 0, warning: 1, info: 2 } as const;
export const sortAlerts = (alerts: OperationalAlert[]) =>
 [...alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

export const timeFmt = (v: string | Date) => new Intl.DateTimeFormat("es-PR", { hour: "numeric", minute: "2-digit" }).format(new Date(v));
export const dateFmt = (v: string) => new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short" }).format(new Date(v.length === 10 ? `${v}T12:00:00` : v));
export const relativeFmt = (v: string) => {
 const diff = Date.now() - new Date(v).getTime(), h = Math.round(diff / 3_600_000);
 if (h < 1) return "Hace menos de una hora";
 if (h < 24) return `Hace ${h} ${h === 1 ? "hora" : "horas"}`;
 const d = Math.round(h / 24);
 return `Hace ${d} ${d === 1 ? "día" : "días"}`;
};
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
