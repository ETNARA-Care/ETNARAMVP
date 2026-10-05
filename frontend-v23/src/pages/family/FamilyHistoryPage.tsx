import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyRecipient, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";
import { Badge, Card, EmptyState, ErrorState, IconButton, Skeleton, Timeline } from "@/components/ui";

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

  const sortedShifts = useMemo(
    () => (shifts ?? []).slice().sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()),
    [shifts],
  );
  const completedShifts = useMemo(
    () => sortedShifts.filter((shift) => shift.status === "completed" || Boolean(shift.checkedOutAt)).reverse(),
    [sortedShifts],
  );
  const openShift = completedShifts.find((shift) => shift.id === openShiftId);

  if (shifts === null) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-28" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (openShift) return <HistoryDayDetail shift={openShift} timeline={timeline} onBack={() => setOpenShiftId(null)} />;

  const now = Date.now();
  const upcoming = sortedShifts.filter((shift) => shift.status !== "cancelled" && !shift.checkedOutAt && new Date(shift.scheduledEnd).getTime() >= now);
  const name = recipient?.preferredName || recipient?.firstName || "tu familiar";
  const statusFor = (shift: FamilyShiftSummary) => {
    if (shift.status === "cancelled") return { tone: "danger" as const, label: "Cancelado" };
    if (shift.checkedOutAt || shift.status === "completed") return { tone: "neutral" as const, label: "Completado" };
    if (shift.checkedInAt || shift.status === "in_progress") return { tone: "success" as const, label: "En curso" };
    if (!shift.caregiver) return { tone: "warning" as const, label: "Sin asignar" };
    return { tone: "success" as const, label: "Próximo" };
  };

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium text-[#66845f]">Calendario</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">Turnos de {name}</h1>
        <p className="mt-1 text-sm text-[#667085]">Consulta quién brindará el cuidado y el estado de cada turno.</p>
      </section>

      <section className="rounded-[22px] bg-[#102b57] p-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8c9ad]">Próximos</p><p className="mt-1 font-display text-3xl">{upcoming.length}</p></div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#b8c9ad]"><CalendarDays size={21} /></div>
        </div>
        <p className="mt-2 text-sm text-white/70">{upcoming.length ? "Turnos programados o en curso." : "No hay turnos próximos registrados."}</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl text-[#102b57]">Próximos turnos</h2></div>
        {upcoming.length === 0 ? (
          <div className="rounded-[22px] border border-[#102b57]/10 bg-white p-5 text-sm text-[#667085]">No hay turnos próximos registrados.</div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((shift) => {
              const state = statusFor(shift);
              return <article key={shift.id} className="rounded-[22px] border border-[#102b57]/10 bg-white p-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-medium capitalize text-[#173154]">{formatDate(shift.scheduledStart)}</p><p className="mt-1 text-sm text-[#667085]">{new Date(shift.scheduledStart).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {new Date(shift.scheduledEnd).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}</p></div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#f8f5ee] p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef3e9] text-[#66845f]">{shift.caregiver?.credentials?.length ? <ShieldCheck size={17} /> : <Clock3 size={17} />}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-[#173154]">{caregiverName(shift)}</p><p className="text-xs text-[#98a2b3]">{shift.caregiver?.credentials?.length ? "Profesional con credenciales verificadas" : shift.caregiver ? "Cuidador asignado" : "Pendiente de asignación"}</p></div>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-[#102b57]">Turnos completados</h2>
        {completedShifts.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={28} />} title="No hay turnos completados todavía." description="Cuando finalice un turno, aparecerá aquí con las actualizaciones autorizadas." />
        ) : (
          <div className="flex flex-col gap-2">
            {completedShifts.map((shift) => <HistoryDayRow key={shift.id} shift={shift} timeline={timeline} onOpen={setOpenShiftId} />)}
          </div>
        )}
      </section>
    </div>
  );
}
