import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--color-ivory-200)] text-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
  warning: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
  danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]",
  accent: "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[var(--text-caption)] font-semibold uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Mapea estados de dominio reales (turnos, incidentes, credenciales) a un
 * tono consistente. Un solo lugar para decidir "qué color significa qué"
 * en toda la app -- evita que cada pantalla invente su propio mapeo.
 */
export type DomainStatus =
  | "active" | "pending" | "completed" | "cancelled" | "in_progress" | "assigned"
  | "confirmed" | "unassigned" | "open" | "resolved" | "expiring" | "expired";

const statusConfig: Record<DomainStatus, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Activo" },
  assigned: { tone: "accent", label: "Asignado" },
  confirmed: { tone: "accent", label: "Asignado" },
  pending: { tone: "warning", label: "Pendiente" },
  completed: { tone: "neutral", label: "Completado" },
  cancelled: { tone: "danger", label: "Cancelado" },
  in_progress: { tone: "accent", label: "En curso" },
  unassigned: { tone: "warning", label: "Sin asignar" },
  open: { tone: "danger", label: "Abierto" },
  resolved: { tone: "success", label: "Resuelto" },
  expiring: { tone: "warning", label: "Por vencer" },
  expired: { tone: "danger", label: "Vencido" },
};

export function StatusBadge({ status }: { status: DomainStatus }) {
  const cfg = statusConfig[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
