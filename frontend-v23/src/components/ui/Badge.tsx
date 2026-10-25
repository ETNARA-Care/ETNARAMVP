import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

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
 data-ui="badge"
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

// label = key in the common catalog (status.*); the API value itself is never translated.
const statusConfig: Record<DomainStatus, { tone: Tone; labelKey: "active" | "assigned" | "pending" | "completed" | "cancelled" | "in_progress" | "unassigned" | "open" | "resolved" | "expiring" | "expired" }> = {
  active: { tone: "success", labelKey: "active" },
  assigned: { tone: "accent", labelKey: "assigned" },
  confirmed: { tone: "accent", labelKey: "assigned" },
  pending: { tone: "warning", labelKey: "pending" },
  completed: { tone: "neutral", labelKey: "completed" },
  cancelled: { tone: "danger", labelKey: "cancelled" },
  in_progress: { tone: "accent", labelKey: "in_progress" },
  unassigned: { tone: "warning", labelKey: "unassigned" },
  open: { tone: "danger", labelKey: "open" },
  resolved: { tone: "success", labelKey: "resolved" },
  expiring: { tone: "warning", labelKey: "expiring" },
  expired: { tone: "danger", labelKey: "expired" },
};

export function StatusBadge({ status }: { status: DomainStatus }) {
  const { t } = useTranslation("common");
  const cfg = statusConfig[status];
  return <Badge tone={cfg.tone}>{t(`status.${cfg.labelKey}`)}</Badge>;
}
