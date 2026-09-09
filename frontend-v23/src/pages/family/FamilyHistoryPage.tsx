import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyRecipient, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";
import { Card, EmptyState, ErrorState, IconButton, PageHeader, Skeleton, Timeline } from "@/components/ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function caregiverName(shift: FamilyShiftSummary) {
  return shift.caregiver?.displayName || "Sin cuidador registrado";
}

function eventsForShift(shift: FamilyShiftSummary, timeline: FamilyTimelineItem[]) {
  const start = new Date(shift.scheduledStart).getTime();
  const end = new Date(shift.checkedOutAt || shift.scheduledEnd).getTime();
  return timeline
    .filter((item) => {
      const occurredAt = new Date(item.occurredAt).getTime();
      return occurredAt >= start && occurredAt <= end;
    })
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

function HistoryDayRow({ shift, timeline, onOpen }: {
  shift: FamilyShiftSummary;
  timeline: FamilyTimelineItem[];
  onOpen: (id: string) => void;
}) {
  const events = eventsForShift(shift, timeline);
  const summary = events.at(-1);
  return (
    <button type="button" onClick={() => onOpen(shift.id)} className="text-left w-full">
      <Card className="flex flex-col gap-1 hover:bg-[var(--color-ivory-100)] transition-colors">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-[var(--color-text-primary)] capitalize">{formatDate(shift.scheduledStart)}</p>
          <span className="text-[var(--text-caption)] text-[var(--color-text-muted)] shrink-0">
            {new Date(shift.scheduledStart).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {new Date(shift.scheduledEnd).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Cuidador: {caregiverName(shift)}</p>
        <p className="text-[var(--text-body)] text-[var(--color-text-primary)] mt-1">
          {summary ? `“${summary.title}: ${summary.summary}”` : "Turno completado sin actualizaciones familiares."}
        </p>
      </Card>
    </button>
  );
}

function HistoryDayDetail({ shift, timeline, onBack }: {
  shift: FamilyShiftSummary;
  timeline: FamilyTimelineItem[];
  onBack: () => void;
}) {
  const entries = eventsForShift(shift, timeline).map((item) => ({
    id: item.id,
    time: new Date(item.occurredAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: `${item.title}: ${item.summary}`,
    description: item.caregiver.displayName || undefined,
    tone: item.type === "incident" ? ("danger" as const) : undefined,
  }));

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <div className="flex items-center gap-2">
        <IconButton icon={<ArrowLeft size={18} />} label="Volver al historial" onClick={onBack} />
        <div>
          <p className="font-display text-[var(--text-h3)] capitalize">{formatDate(shift.scheduledStart)}</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {new Date(shift.scheduledStart).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {new Date(shift.scheduledEnd).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} · {caregiverName(shift)}
          </p>
        </div>
      </div>
      {entries.length > 0 ? (
        <Timeline entries={entries} />
      ) : (
        <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay actualizaciones familiares registradas para ese turno.</p>
      )}
    </div>
  );
}

export function FamilyHistoryPage() {
  const { activeOrganization } = useAuth();
  const [recipient, setRecipient] = useState<FamilyRecipient | null>(null);
  const [shifts, setShifts] = useState<FamilyShiftSummary[] | null>(null);
  const [timeline, setTimeline] = useState<FamilyTimelineItem[]>([]);
  const [openShiftId, setOpenShiftId] = useState<string | null>(null);
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

  const completedShifts = useMemo(
    () => (shifts ?? [])
      .filter((shift) => shift.status === "completed" || Boolean(shift.checkedOutAt))
      .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()),
    [shifts],
  );
  const openShift = completedShifts.find((shift) => shift.id === openShiftId);

  if (shifts === null) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (openShift) return <HistoryDayDetail shift={openShift} timeline={timeline} onBack={() => setOpenShiftId(null)} />;

  const name = recipient?.preferredName || recipient?.firstName || "tu familiar";
  return (
    <div>
      <PageHeader title="Historial" description={`Días anteriores del cuidado de ${name}.`} />
      {completedShifts.length === 0 ? (
        <EmptyState
          icon={<Clock3 size={28} />}
          title="No hay actividad registrada todavía."
          description="Cuando haya turnos completados, aparecerán aquí ordenados por fecha."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {completedShifts.map((shift) => <HistoryDayRow key={shift.id} shift={shift} timeline={timeline} onOpen={setOpenShiftId} />)}
        </div>
      )}
    </div>
  );
}
