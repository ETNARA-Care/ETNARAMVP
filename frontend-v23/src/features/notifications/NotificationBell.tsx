import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { IconButton, Badge } from "@/components/ui";
import { useNotifications } from "./useNotifications";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

/** Campana conectada a la bandeja real del usuario autenticado. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, unread, error, reload, markRead } = useNotifications();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void reload();
  }

  return (
    <div className="relative">
      <div className="relative">
        <IconButton
          icon={<Bell size={20} />}
          label={unread > 0 ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
          onClick={toggle}
        />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-danger-700)]"
          />
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[var(--z-overlay)]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Notificaciones"
            className="absolute right-0 top-12 z-[var(--z-modal)] w-[320px] max-w-[85vw]
              bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)]
              shadow-[var(--shadow-raised)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--color-border)]">
              <p className="font-medium text-[var(--text-body)] text-[var(--color-text-primary)]">Notificaciones</p>
              {unread > 0 && <Badge tone="accent">{unread} sin leer</Badge>}
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {error ? (
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="w-full text-[var(--text-small)] text-[var(--color-danger-700)] text-center py-6 px-3"
                >
                  No pudimos cargar las notificaciones. Toca para reintentar.
                </button>
              ) : items === null ? (
                <p className="text-[var(--text-small)] text-[var(--color-text-muted)] text-center py-6 px-3">
                  Cargando notificaciones…
                </p>
              ) : items.length === 0 ? (
                <p className="text-[var(--text-small)] text-[var(--color-text-muted)] text-center py-6 px-3">
                  No tienes notificaciones nuevas.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => void markRead(n.id)}
                    className={`w-full text-left flex items-start gap-2 px-3.5 py-3 border-b border-[var(--color-border)] last:border-b-0
                      transition-colors hover:bg-[var(--color-ivory-100)]
                      ${n.readAt ? "" : "bg-[var(--color-accent-100)]/40"}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-[var(--color-accent-700)]"}`}
                    />
                    <span className="flex-1">
                      <span className="block text-[var(--text-small)] text-[var(--color-text-primary)]">{n.summary}</span>
                      <span className="block text-[var(--text-caption)] text-[var(--color-text-muted)] mt-0.5">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <Check size={14} className="text-[var(--color-text-muted)] mt-1.5" aria-hidden />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
