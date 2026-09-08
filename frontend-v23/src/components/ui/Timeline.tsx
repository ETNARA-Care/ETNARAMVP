import type { ReactNode } from "react";

export interface TimelineEntry {
  id: string;
  time: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: "neutral" | "warning" | "danger";
}

const dotTone: Record<NonNullable<TimelineEntry["tone"]>, string> = {
  neutral: "bg-[var(--color-navy-700)]",
  warning: "bg-[var(--color-warning-700)]",
  danger: "bg-[var(--color-danger-700)]",
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="relative flex flex-col gap-[var(--spacing-md)] pl-6">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--color-border)]" aria-hidden />
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span
            className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-[var(--color-bg)] ${dotTone[entry.tone ?? "neutral"]}`}
            aria-hidden
          />
          <div className="flex items-baseline gap-2">
            <time className="text-[var(--text-caption)] font-medium text-[var(--color-text-muted)]">{entry.time}</time>
            <p className="font-medium text-[var(--text-body)] text-[var(--color-text-primary)]">{entry.title}</p>
          </div>
          {entry.description && (
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-0.5">{entry.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
