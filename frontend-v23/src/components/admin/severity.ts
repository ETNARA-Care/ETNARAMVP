/** Semántica de estado del Portal Administrativo: un solo lugar decide qué color significa qué. */
export type AdminSeverity = "critical" | "warning" | "info" | "ok";

export const severityStyle: Record<AdminSeverity, { label: string; text: string; dot: string; tint: string }> = {
 critical: { label: "Urgente", text: "text-[var(--color-danger-700)]", dot: "bg-[var(--color-danger-700)]", tint: "bg-[var(--color-danger-100)]" },
 warning: { label: "Atención", text: "text-[var(--color-warning-700)]", dot: "bg-[var(--color-warning-700)]", tint: "bg-[var(--color-warning-100)]" },
 info: { label: "Planificar", text: "text-[var(--color-accent-700)]", dot: "bg-[var(--color-accent-700)]", tint: "bg-[var(--color-accent-100)]" },
 ok: { label: "En orden", text: "text-[var(--color-success-700)]", dot: "bg-[var(--color-success-700)]", tint: "bg-[var(--color-success-100)]" },
};
