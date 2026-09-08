import { Activity, Clock3, UserCheck, Users } from "lucide-react";
import { PageHeader, StatCard, Card, SectionHeader, StatusBadge, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { recipientName } from "@/api/shifts";
import { isToday, useAgencySupervision, type AdminCareEvent, type AdminShift } from "@/features/agency/useAgencySupervision";

const eventLabel: Record<string, string> = {
  MEAL: "Comida registrada",
  HYDRATION: "Hidratación registrada",
  TOILETING: "Asistencia al baño",
  MOBILITY: "Movilidad registrada",
  ACTIVITY: "Actividad registrada",
  MOOD: "Estado de ánimo",
  NOTE: "Nota de cuidado",
};

function caregiverName(shift: AdminShift): string {
  return shift.caregiver?.display_name ?? shift.caregiver?.internal_role ?? "Sin cuidadora asignada";
}

function eventDetail(event: AdminCareEvent): string | null {
  if (event.note_text) return event.note_text;
  if (!event.structured_data || typeof event.structured_data !== "object") return null;
  const data = event.structured_data as Record<string, unknown>;
  const detail = data.label ?? data.mealType ?? data.amount ?? data.result ?? data.activity ?? data.mood;
  return typeof detail === "string" ? detail : null;
}

export function AgencyOverviewPage() {
  const { loading, error, shifts, events, reload } = useAgencySupervision();

  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void reload()} />;

  const todayShifts = shifts.filter((shift) => isToday(shift.scheduled_start));
  const todayEvents = events.filter((event) => isToday(event.occurred_at));
  const covered = todayShifts.filter((shift) => Boolean(shift.caregiver)).length;
  const unassigned = todayShifts.filter((shift) => !shift.caregiver && shift.status !== "cancelled").length;
  const activeNow = todayShifts.filter((shift) => shift.status === "in_progress").length;
  const recentEvents = [...todayEvents]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <PageHeader title="Overview" description="Supervisión operacional en tiempo real · hoy" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Turnos cubiertos" value={covered} tone="success" icon={<UserCheck size={18} />} />
        <StatCard label="Turnos sin cubrir" value={unassigned} tone={unassigned > 0 ? "warning" : "neutral"} hint={unassigned > 0 ? "Requiere asignación" : undefined} icon={<Users size={18} />} />
        <StatCard label="Turnos en curso" value={activeNow} tone={activeNow > 0 ? "success" : "neutral"} icon={<Clock3 size={18} />} />
        <StatCard label="Actividades hoy" value={todayEvents.length} tone="neutral" icon={<Activity size={18} />} />
      </div>

      <div>
        <SectionHeader title="Turnos de hoy" />
        {todayShifts.length === 0 ? (
          <EmptyState title="No hay turnos programados para hoy" />
        ) : (
          <div className="flex flex-col gap-2">
            {todayShifts.map((shift) => <ShiftSummaryRow key={shift.id} shift={shift} />)}
          </div>
        )}
      </div>

      <div>
        <SectionHeader title="Actividad reciente" />
        {recentEvents.length === 0 ? (
          <EmptyState icon={<Activity size={28} />} title="No hay actividad registrada hoy" />
        ) : (
          <div className="flex flex-col gap-2">
            {recentEvents.map((event) => <RecentActivityRow key={event.id} event={event} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function RecentActivityRow({ event }: { event: AdminCareEvent }) {
  const detail = eventDetail(event);
  return (
    <Card className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-[var(--text-body)] text-[var(--color-text-primary)]">
          {eventLabel[event.type_code] ?? event.type_code} <span className="text-[var(--color-text-secondary)]">· {recipientName(event.recipient)}</span>
        </p>
        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">
          {event.caregiver?.display_name ?? event.caregiver?.internal_role ?? "Cuidadora"}{detail ? ` · ${detail}` : ""}
        </p>
      </div>
      <span className="text-[var(--text-caption)] text-[var(--color-text-muted)] shrink-0">
        {new Date(event.occurred_at).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
      </span>
    </Card>
  );
}

function ShiftSummaryRow({ shift }: { shift: AdminShift }) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <p className="font-medium text-[var(--color-text-primary)]">{recipientName(shift.recipient)}</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Cuidadora: {caregiverName(shift)}</p>
        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">
          {start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – {end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <StatusBadge status={shift.status} />
    </Card>
  );
}
