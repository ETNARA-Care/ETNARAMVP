import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)]
        shadow-[var(--shadow-card)] p-[var(--spacing-md)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  icon?: ReactNode;
}

const toneText: Record<NonNullable<StatCardProps["tone"]>, string> = {
  neutral: "text-[var(--color-text-primary)]",
  success: "text-[var(--color-success-700)]",
  warning: "text-[var(--color-warning-700)]",
  danger: "text-[var(--color-danger-700)]",
};

/** Cada métrica del Portal Agencia debe poder responder "¿y ahora qué hago?" -- por eso admite hint. */
export function StatCard({ label, value, hint, tone = "neutral", icon }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-small)] text-[var(--color-text-secondary)] font-medium">{label}</span>
        {icon && <span className="text-[var(--color-text-muted)]" aria-hidden>{icon}</span>}
      </div>
      <span className={`font-display text-[var(--text-h2)] ${toneText[tone]}`}>{value}</span>
      {hint && <span className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{hint}</span>}
    </Card>
  );
}
