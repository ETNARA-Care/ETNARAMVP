import { Activity, AlertTriangle, CalendarPlus, Clock3, UserCheck, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatCard, Card, SectionHeader, StatusBadge, EmptyState, ErrorState, Skeleton, Button } from "@/components/ui";
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
  const navigate = useNavigate();
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
      <PageHeader title="Resumen" description="Supervisión operacional en tiempo real · hoy" actions={<Button icon={<CalendarPlus size={18} />} onClick={() => navigate("/agency/shifts?create=1")}>Crear turno</Button>} />

      <div>
        <SectionHeader title="Acciones rápidas" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Button variant="secondary" icon={<CalendarPlus size={18} />} onClick={() => navigate("/agency/shifts?create=1")}>Crear turno</Button>
          <Button variant="secondary" icon={<UserPlus size={18} />} onClick={() => navigate("/agency/residents")}>Residentes</Button>
          <Button variant="secondary" icon={<Users size={18} />} onClick={() => navigate("/agency/workers")}>Cuidadores</Button>
          <Button variant="secondary" icon={<AlertTriangle size={18} />} onClick={() => navigate("/agency/incidents")}>Incidentes</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DashboardAction label="Abrir turnos cubiertos" onClick={() => navigate("/agency/shifts")}><StatCard label="Turnos cubiertos" value={covered} tone="success" hint="Ver turnos" icon={<UserCheck size={18} />} /></DashboardAction>
        <DashboardAction label="Abrir turnos sin cubrir" onClick={() => navigate("/agency/shifts")}><StatCard label="Turnos sin cubrir" value={unassigned} tone={unassigned > 0 ? "warning" : "neutral"} hint={unassigned > 0 ? "Asignar ahora" : "Ver turnos"} icon={<Users size={18} />} /></DashboardAction>
        <DashboardAction label="Abrir turnos en curso" onClick={() => navigate("/agency/shifts")}><StatCard label="Turnos en curso" value={activeNow} tone={activeNow > 0 ? "success" : "neutral"} hint="Ver seguimiento" icon={<Clock3 size={18} />} /></DashboardAction>
        <DashboardAction label="Ir a la actividad reciente" onClick={() => document.getElementById("actividad-reciente")?.scrollIntoView({ behavior: "smooth" })}><StatCard label="Actividades hoy" value={todayEvents.length} tone="neutral" hint="Ver actividad" icon={<Activity size={18} />} /></DashboardAction>
      </div>

      <div>
        <SectionHeader title="Turnos de hoy" />
        {todayShifts.length === 0 ? (
          <EmptyState title="No hay turnos programados para hoy" action={{ label: "Crear turno", onClick: () => navigate("/agency/shifts?create=1") }} />
        ) : (
          <div className="flex flex-col gap-2">
            {todayShifts.map((shift) => <ShiftSummaryRow key={shift.id} shift={shift} />)}
          </div>
        )}
      </div>

      <div id="actividad-reciente">
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
  const navigate = useNavigate();
  const detail = eventDetail(event);
  return (
    <Card role="link" tabIndex={0} onClick={() => navigate(`/agency/residents/${event.care_recipient_id}`)} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") navigate(`/agency/residents/${event.care_recipient_id}`); }} className="flex items-center justify-between gap-3 py-2.5 cursor-pointer hover:bg-[var(--color-ivory-100)] transition-colors">
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
  const navigate = useNavigate();
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return (
    <Card role="link" tabIndex={0} onClick={() => navigate(`/agency/shifts/${shift.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(`/agency/shifts/${shift.id}`); }} className="flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--color-ivory-100)] transition-colors">
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

function DashboardAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} onClick={onClick} className="text-left rounded-[var(--radius-lg)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-navy-700)] [&>div]:h-full">{children}</button>;
}
