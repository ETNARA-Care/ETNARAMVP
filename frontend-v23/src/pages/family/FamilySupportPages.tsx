import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState, ErrorState, Card, Timeline, Avatar, Badge, Button, Skeleton } from "@/components/ui";
import { CheckCircle2, MessageCircle, Clock3, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";
import { useNotifications } from "@/features/notifications/useNotifications";
import type { NotificationItem } from "@/api/notifications";

function isToday(iso: string): boolean {
  const event = new Date(iso);
  const now = new Date();
  return event.getFullYear() === now.getFullYear() && event.getMonth() === now.getMonth() && event.getDate() === now.getDate();
}

function familyEntryTitle(item: FamilyTimelineItem): string {
  const caregiver = item.caregiver.displayName ? ` · ${item.caregiver.displayName}` : "";
  return `${item.title}: ${item.summary}${caregiver}`;
}

export function FamilyActivityPage() {
  const { activeOrganization } = useAuth();
  const [items, setItems] = useState<FamilyTimelineItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setError(false);
    try {
      const recipients = await listMyCareRecipients(token);
      const recipient = activeOrganization
        ? recipients.find((item) => item.organizationId === activeOrganization.id) ?? recipients[0]
        : recipients[0];
      if (!recipient) { setItems([]); return; }
      setItems(await getFamilyTimeline(recipient.organizationId, recipient.recipientId, token));
    } catch { setError(true); setItems([]); }
  }, [activeOrganization]);

  useEffect(() => { void load(); }, [load]);

  if (items === null) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  const today = items.filter((item) => isToday(item.occurredAt));

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium text-[#66845f]">Cuidado</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">Actividad de hoy</h1>
        <p className="mt-1 text-sm text-[#667085]">Actualizaciones compartidas sobre el cuidado de tu familiar.</p>
      </section>

      <section className="rounded-[22px] bg-[#102b57] px-5 py-4 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8c9ad]">Resumen</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div><span className="font-display text-4xl">{today.length}</span><span className="ml-2 text-sm text-white/70">{today.length === 1 ? "actualización hoy" : "actualizaciones hoy"}</span></div>
          <Clock3 size={22} className="text-[#b8c9ad]" />
        </div>
      </section>

      {today.length === 0 ? (
        <div className="rounded-[22px] border border-[#102b57]/10 bg-white p-6 text-center shadow-[0_8px_28px_rgba(16,43,87,.05)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#eef3e9] text-[#66845f]"><Clock3 size={20} /></div>
          <h2 className="mt-3 font-display text-xl text-[#102b57]">Todavía no hay actualizaciones hoy</h2>
          <p className="mt-1 text-sm text-[#667085]">Cuando el equipo registre actividad autorizada, aparecerá aquí.</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[22px] border border-[#102b57]/10 bg-white px-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
          {today.map((item, index) => (
            <article key={item.id} className={`flex gap-3 py-4 ${index ? "border-t border-[#102b57]/8" : ""}`}>
              <div className="flex flex-col items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef3e9] text-[#66845f]"><CheckCircle2 size={17} /></div>
                {index < today.length - 1 ? <div className="mt-1 w-px flex-1 bg-[#102b57]/10" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-medium text-[#173154]">{item.title}</h2>
                  <time className="shrink-0 text-xs text-[#98a2b3]">{new Date(item.occurredAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}</time>
                </div>
                <p className="mt-1 text-sm leading-6 text-[#667085]">{item.summary}</p>
                {item.caregiver.displayName ? <p className="mt-2 text-xs font-medium text-[#66845f]">{item.caregiver.displayName}</p> : null}
              </div>
            </article>
          ))}
        </section>
      )}

      <p className="px-1 text-xs leading-5 text-[#98a2b3]">Solo se muestran actualizaciones autorizadas para familiares. La información interna del personal permanece protegida.</p>
    </div>
  );
}

export function FamilyProfilePage() {
  const { user, activeOrganization, logout } = useAuth();
  const navigate = useNavigate();
  const [caregiver, setCaregiver] = useState<FamilyShiftSummary["caregiver"] | undefined>();

  const loadCaregiver = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const recipients = await listMyCareRecipients(token);
      const recipient = activeOrganization
        ? recipients.find((item) => item.organizationId === activeOrganization.id) ?? recipients[0]
        : recipients[0];
      if (!recipient) {
        setCaregiver(null);
        return;
      }
      const shifts = await listFamilyShifts(recipient.organizationId, recipient.recipientId, token);
      setCaregiver(shifts.find((shift) => shift.status !== "cancelled" && shift.caregiver)?.caregiver ?? null);
    } catch {
      setCaregiver(null);
    }
  }, [activeOrganization]);

  useEffect(() => { void loadCaregiver(); }, [loadCaregiver]);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Perfil" />
      <Card className="flex items-center gap-3">
        <Avatar name="Ana Rivera" size={48} />
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Ana Rivera</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Contacto principal de Carmen Rivera</p>
          {user?.email && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">Sesión: {user.email}</p>}
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[var(--color-success-700)]" />
            <p className="font-medium text-[var(--color-text-primary)]">Cuidadora asignada</p>
          </div>
          {caregiver && caregiver.credentials.length > 0 && <Badge tone="success">Profesional verificada</Badge>}
        </div>
        {caregiver === undefined ? <Skeleton className="h-24" /> : caregiver === null ? (
          <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay cuidadora asignada actualmente.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={caregiver.displayName} size={40} />
              <p className="font-medium text-[var(--color-text-primary)]">{caregiver.displayName}</p>
            </div>
            <p className="text-[var(--text-caption)] font-medium text-[var(--color-text-secondary)] mb-2">Credenciales verificadas</p>
            {caregiver.credentials.length === 0 ? (
              <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">Aún no hay credenciales verificadas disponibles.</p>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--color-border)]">
                {caregiver.credentials.map((credential) => (
                  <div key={credential.typeCode} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                    <CheckCircle2 size={18} className="text-[var(--color-success-700)] shrink-0" />
                    <div className="flex-1">
                      <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">{credential.typeName}</p>
                      {credential.expiresAt && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Vigente hasta {new Date(`${credential.expiresAt}T00:00:00`).toLocaleDateString("es-PR")}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-3">Se muestra únicamente el estado verificado; los documentos y datos privados permanecen protegidos.</p>
          </>
        )}
      </Card>
      <Button variant="secondary" icon={<LogOut size={18} />} onClick={onLogout}>Cerrar sesión</Button>
    </div>
  );
}

export function FamilyNotificationsPage() {
  const navigate = useNavigate();
  const { items, unread, error, reload, markRead, markAllRead } = useNotifications();

  async function openNotification(notification: NotificationItem) {
    await markRead(notification.id);
    if (notification.relatedEntityType === "incident" && notification.relatedEntityId) {
      navigate(`/family/incidents/${notification.relatedEntityId}`);
    } else if (notification.relatedEntityType === "message_thread" && notification.relatedEntityId) {
      navigate(`/family/messages?thread=${notification.relatedEntityId}`);
    } else if (notification.type === "SHIFT_STARTED" || notification.type === "SHIFT_COMPLETED") {
      navigate("/family");
    } else if (notification.type === "NEW_CARE_EVENT") {
      navigate("/family/activity");
    }
  }

  if (items === null) {
    return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  }
  if (error) return <ErrorState kind="server" onRetry={() => void reload()} />;

  return (
    <div>
      <PageHeader
        title="Notificaciones"
        actions={unread > 0 ? <Button variant="secondary" onClick={() => void markAllRead()}>Marcar todas como leídas</Button> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<MessageCircle size={28} />} title="No tienes notificaciones nuevas." />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((notification) => (
            <button
              type="button"
              key={notification.id}
              onClick={() => void openNotification(notification)}
              className="text-left"
            >
              <Card className={notification.readAt ? "" : "border-[var(--color-accent-700)] bg-[var(--color-accent-100)]/30"}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{notification.summary}</p>
                    <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">
                      {new Date(notification.createdAt).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {!notification.readAt && <Badge tone="accent">Nueva</Badge>}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
