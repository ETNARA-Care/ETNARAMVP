import { useEffect, useState } from "react";
import { listMyNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from "../api/notifications";
import { LoadingState, EmptyState, ErrorState } from "../components/UiStates";
import { Card } from "../components/Primitives";

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    listMyNotifications()
      .then((res) => setItems(res.items))
      .catch(() => setError("No pudimos cargar tus notificaciones."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleMarkRead(id: string) {
    setItems((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) : prev));
    try {
      await markNotificationRead(id);
    } catch {
      load(); // revert to server truth on failure
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      load();
    } catch {
      setError("No pudimos actualizar las notificaciones.");
    }
  }

  if (loading) return <LoadingState label="Cargando notificaciones..." />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!items || items.length === 0) {
    return <EmptyState title="Sin notificaciones" description="Aquí verás avisos sobre mensajes y actividad relevante." />;
  }

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div style={{ padding: 16, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display)", color: "var(--color-ink)", margin: 0 }}>
          Notificaciones
        </h1>
        {hasUnread && (
          <button
            onClick={handleMarkAll}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-caption)",
              background: "none",
              border: "none",
              color: "var(--color-ink-soft)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {items.map((n) => (
        <Card key={n.id} style={{ marginBottom: 10, opacity: n.readAt ? 0.65 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-body)", color: "var(--color-ink)", margin: 0, fontWeight: n.readAt ? 400 : 600 }}>
                {n.summary}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", color: "var(--color-ink-soft)", margin: "4px 0 0" }}>
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
            {!n.readAt && (
              <button
                onClick={() => handleMarkRead(n.id)}
                aria-label="Marcar como leída"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--fs-caption)",
                  background: "var(--color-ink-tint)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Marcar leída
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
