import type { ReactNode } from "react";
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

const errorConfig: Record<ErrorKind, { icon: ReactNode; title: string; description: string }> = {
  offline: {
    icon: <WifiOff size={28} />,
    title: "Sin conexión",
    description: "No hay conexión a internet en este momento. Los cambios se guardarán al reconectar.",
  },
  network: {
    icon: <WifiOff size={28} />,
    title: "Error de red",
    description: "No pudimos completar la solicitud. Verifica tu conexión e intenta de nuevo.",
  },
  server: {
    icon: <ServerCrash size={28} />,
    title: "Error del servidor",
    description: "Algo falló de nuestro lado. Ya lo sabemos -- intenta de nuevo en un momento.",
  },
  permission: {
    icon: <ShieldAlert size={28} />,
    title: "Acceso no permitido",
    description: "Tu cuenta no tiene permiso para ver este contenido.",
  },
  not_found: {
    icon: <SearchX size={28} />,
    title: "No encontrado",
    description: "No pudimos encontrar lo que buscabas.",
  },
};

export function ErrorState({ kind, onRetry }: { kind: ErrorKind; onRetry?: () => void }) {
  const cfg = errorConfig[kind];
  return (
    <EmptyState
      icon={cfg.icon}
      title={cfg.title}
      description={cfg.description}
      action={onRetry ? { label: "Reintentar", onClick: onRetry } : undefined}
    />
  );
}
