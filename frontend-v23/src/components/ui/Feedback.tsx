import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Inbox, WifiOff, ServerCrash, ShieldAlert, SearchX } from "lucide-react";
import { Button } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-ivory-200)] ${className}`}
    />
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** Un empty state debe leerse como una invitación a actuar, no como un error. */
export function EmptyState({ icon = <Inbox size={28} />, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-[var(--spacing-xl)] px-[var(--spacing-md)]">
      <div className="text-[var(--color-text-muted)]" aria-hidden>{icon}</div>
      <p className="font-medium text-[var(--color-text-primary)]">{title}</p>
      {description && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] max-w-[32ch]">{description}</p>}
      {action && (
        <Button variant="secondary" size="md" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}

type ErrorKind = "offline" | "network" | "server" | "permission" | "not_found";

const ERROR_KEY: Record<ErrorKind, "offline" | "network" | "server" | "permission" | "notFound"> = {
  offline: "offline", network: "network", server: "server", permission: "permission", not_found: "notFound",
};
const errorIcon: Record<ErrorKind, ReactNode> = {
  offline: <WifiOff size={28} />,
  network: <WifiOff size={28} />,
  server: <ServerCrash size={28} />,
  permission: <ShieldAlert size={28} />,
  not_found: <SearchX size={28} />,
};

export function ErrorState({ kind, onRetry }: { kind: ErrorKind; onRetry?: () => void }) {
  const { t } = useTranslation("common");
  const key = ERROR_KEY[kind];
  return (
    <EmptyState
      icon={errorIcon[kind]}
      title={t(`states.${key}.title`)}
      description={t(`states.${key}.description`)}
      action={onRetry ? { label: t("actions.retry"), onClick: onRetry } : undefined}
    />
  );
}
