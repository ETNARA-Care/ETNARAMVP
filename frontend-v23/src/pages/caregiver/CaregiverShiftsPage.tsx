import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listCareRecipients, listMyShifts, recipientName, type CareRecipient, type Shift } from "@/api/shifts";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from "@/components/ui";

function formatWindow(shift: Shift): string {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" })} · ${start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`;
}

export function CaregiverShiftsPage() {
  const { activeOrganization } = useAuth();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [error, setError] = useState(false);
  const organizationId = activeOrganization?.id;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const [shiftRows, recipientRows] = await Promise.all([
        listMyShifts(organizationId, token),
        listCareRecipients(organizationId, token),
      ]);
      setShifts(shiftRows);
      setRecipients(recipientRows);
    } catch {
      setError(true);
      setShifts([]);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const recipientById = useMemo(() => Object.fromEntries(recipients.map((item) => [item.id, item])), [recipients]);
  const ordered = useMemo(() => [...(shifts ?? [])].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [shifts]);
  const open = ordered.filter((shift) => shift.status !== "completed" && shift.status !== "cancelled");
  const completed = ordered.filter((shift) => shift.status === "completed");

  if (shifts === null) return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  const card = (shift: Shift) => (
    <Link key={shift.id} to={`/caregiver/shifts/${shift.id}`}>
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{recipientName(recipientById[shift.care_recipient_id ?? ""])}</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{formatWindow(shift)}</p>
        </div>
        {shift.assignment_response_status === "pending"
          ? <Badge tone="warning">Responder</Badge>
          : <StatusBadge status={shift.status} />}
      </Card>
    </Link>
  );

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <PageHeader title="Tus turnos" description="Asignaciones reales de tu organización." />
      <div>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-2">Asignados</p>
        <div className="flex flex-col gap-3">
          {open.length > 0 ? open.map(card) : <EmptyState title="No tienes turnos asignados" description="Cuando Administración te asigne uno, aparecerá aquí." />}
        </div>
      </div>
      {completed.length > 0 && <div><p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-2">Completados</p><div className="flex flex-col gap-3">{completed.map(card)}</div></div>}
    </div>
  );
}
