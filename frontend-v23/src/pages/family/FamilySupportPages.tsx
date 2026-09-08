import { useCallback, useEffect, useState } from "react";
import { PageHeader, EmptyState, ErrorState, Card, Timeline, Avatar, Button, Skeleton } from "@/components/ui";
import { MessageCircle, Clock3, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyTimelineItem } from "@/api/familyTimeline";

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
