import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState, ErrorState, Card, Timeline, Avatar, Badge, Button, Skeleton } from "@/components/ui";
import { CheckCircle2, MessageCircle, Clock3, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";

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
      if (!recipient) {
        setItems([]);
        return;
      }
      setItems(await getFamilyTimeline(recipient.organizationId, recipient.recipientId, token));
    } catch {
      setError(true);
      setItems([]);
    }
  }, [activeOrganization]);

  useEffect(() => { void load(); }, [load]);

  if (items === null) return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  const entries = items.filter((item) => isToday(item.occurredAt)).map((item) => ({
    id: item.id,
    time: new Date(item.occurredAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: familyEntryTitle(item),
  }));
  return (
    <div>
      <PageHeader title="Actividad" description="Lo que ha pasado hoy, en lenguaje simple." />
      {entries.length === 0 ? (
        <EmptyState icon={<Clock3 size={28} />} title="No hay actividad registrada todavía." />
      ) : (
        <Timeline entries={entries} />
      )}
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
  return (
    <div>
      <PageHeader title="Notificaciones" />
      <EmptyState icon={<MessageCircle size={28} />} title="No tienes notificaciones nuevas." />
    </div>
  );
}
