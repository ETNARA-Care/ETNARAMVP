import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Badge, Avatar, Card, ErrorState, Skeleton, Timeline } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyRecipient, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";

function isToday(iso: string): boolean {
  const value = new Date(iso);
  const today = new Date();
  return value.getFullYear() === today.getFullYear()
    && value.getMonth() === today.getMonth()
    && value.getDate() === today.getDate();
}

function recipientName(recipient: FamilyRecipient | null): string {
  if (!recipient) return "Tu familiar";
  return recipient.preferredName || `${recipient.firstName} ${recipient.lastName}`.trim();
}

function shiftStatus(shift: FamilyShiftSummary | undefined): { tone: "success" | "neutral" | "warning"; label: string } {
  if (!shift) return { tone: "warning", label: "Sin turno" };
  if (shift.checkedOutAt || shift.status === "completed") return { tone: "neutral", label: "Finalizado" };
  if (shift.checkedInAt || shift.status === "in_progress") return { tone: "success", label: "En turno" };
  if (shift.caregiver) return { tone: "success", label: "Asignado" };
  return { tone: "warning", label: "Por confirmar" };
}

export function FamilyTodayPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const [recipient, setRecipient] = useState<FamilyRecipient | null>(null);
  const [shifts, setShifts] = useState<FamilyShiftSummary[] | null>(null);
  const [timeline, setTimeline] = useState<FamilyTimelineItem[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setError(false);
    try {
      const recipients = await listMyCareRecipients(token);
      const selected = activeOrganization
        ? recipients.find((item) => item.organizationId === activeOrganization.id) ?? recipients[0]
        : recipients[0];
      if (!selected) {
        setRecipient(null);
        setShifts([]);
        setTimeline([]);
        return;
      }
      const [shiftRows, timelineRows] = await Promise.all([
        listFamilyShifts(selected.organizationId, selected.recipientId, token),
        getFamilyTimeline(selected.organizationId, selected.recipientId, token),
      ]);
      setRecipient(selected);
      setShifts(shiftRows);
      setTimeline(timelineRows);
    } catch {
      setError(true);
      setShifts([]);
      setTimeline([]);
    }
  }, [activeOrganization]);

  useEffect(() => { void load(); }, [load]);

  const shift = useMemo(() => {
    if (!shifts) return undefined;
    return shifts.find((item) => isToday(item.scheduledStart) && !item.checkedOutAt && item.status !== "cancelled")
      ?? shifts.find((item) => isToday(item.scheduledStart))
      ?? shifts.find((item) => item.status !== "cancelled");
  }, [shifts]);
  const entries = timeline.filter((item) => isToday(item.occurredAt)).map((item) => ({
    id: item.id,
    time: new Date(item.occurredAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: `${item.title}: ${item.summary}`,
    tone: item.type === "incident" ? ("danger" as const) : undefined,
  }));
  const lastEntry = entries[0];
  const displayStatus = shiftStatus(shift);
  const caregiver = shift?.caregiver;
  const caredFor = recipientName(recipient);

  if (shifts === null) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-28" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <div>
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">Seguimiento de hoy</p>
        <h1 className="font-display text-[var(--text-h1)] text-[var(--color-text-primary)]">{caredFor}</h1>
      </div>

      <Card className="flex items-center gap-3">
        <Avatar name={caregiver?.displayName ?? "Sin asignar"} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--color-text-primary)]">{caregiver?.displayName ?? "Aún sin cuidador asignado"}</p>
          {caregiver && caregiver.credentials.length > 0 && (
            <button className="mt-1" onClick={() => navigate("/family/profile")}>
              <Badge tone="success"><ShieldCheck size={13} className="mr-1" /> Profesional verificada</Badge>
            </button>
          )}
          {shift && (
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">
              {caregiver ? "Cuidadora de hoy" : "Turno"} · {new Date(shift.scheduledStart).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {new Date(shift.scheduledEnd).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
        <Badge tone={displayStatus.tone}>{displayStatus.label}</Badge>
      </Card>

      <Card>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-1">Última actualización</p>
        {lastEntry ? (
          <>
            <p className="text-[var(--text-body-lg)] text-[var(--color-text-primary)] font-display">“{lastEntry.title}”</p>
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">{lastEntry.time}</p>
          </>
        ) : <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">Todavía no hay actualizaciones hoy.</p>}
      </Card>

      <div>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-3">Resumen del día</p>
        {entries.length > 0 ? <Timeline entries={entries} /> : <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay preocupaciones reportadas.</p>}
      </div>
    </div>
  );
}
