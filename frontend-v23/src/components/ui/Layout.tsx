import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pb-[var(--spacing-md)]">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {breadcrumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              {c.href ? <a href={c.href} className="hover:underline">{c.label}</a> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-[var(--text-h1)] text-[var(--color-text-primary)]">{title}</h1>
          {description && <p className="text-[var(--text-body)] text-[var(--color-text-secondary)] mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-[var(--spacing-xs)]">
      <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{title}</h2>
      {actions}
    </div>
  );
}
