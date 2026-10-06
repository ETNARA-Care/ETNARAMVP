import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listCareRecipients, listMyShifts, recipientName, type CareRecipient, type Shift } from "@/api/shifts";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function windowLabel(shift: Shift) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`;
}
function greeting(date: Date) {
  const hour = date.getHours();
  return hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
}
function shiftLabel(shift: Shift) {
  if (shift.assignment_response_status === "pending") return "Por confirmar";
  if (shift.status === "in_progress") return "En progreso";
  if (shift.status === "completed") return "Completado";
  if (shift.status === "cancelled") return "Cancelado";
  return "Programado";
}

export function CaregiverTodayPage() {
  const { activeOrganization, activeWorkerProfile, user } = useAuth();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [error, setError] = useState(false);
  const organizationId = activeOrganization?.id;
  const now = new Date();
  const firstName = (activeWorkerProfile?.displayName ?? user?.email ?? "Cuidador/a").split(/[ @]/)[0];

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
  const today = ordered.filter((shift) => sameDay(new Date(shift.scheduled_start), now) && shift.status !== "cancelled");
  const main = today.find((shift) => shift.status === "in_progress") ?? today.find((shift) => shift.status !== "completed") ?? today[0];
  const upcoming = ordered.filter((shift) => new Date(shift.scheduled_start) > now && !sameDay(new Date(shift.scheduled_start), now) && shift.status !== "cancelled").slice(0, 2);

  if (shifts === null) return <div className="flex flex-col gap-4"><Skeleton className="h-16" /><Skeleton className="h-52" /><Skeleton className="h-28" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  return <div className="flex flex-col gap-7">
    <header className="px-1">
      <p className="text-sm capitalize text-[var(--color-text-muted)]">{now.toLocaleDateString("es-PR", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 className="mt-1 font-[var(--font-display)] text-3xl text-[var(--color-navy-900)]">{greeting(now)}, {firstName}</h1>
    </header>

    {main ? <Link to={`/caregiver/shifts/${main.id}`} className="block">
      <Card className={`overflow-hidden border-0 p-0 ${main.status === "in_progress" ? "bg-[var(--color-navy-900)] text-white" : "bg-white"}`}>
        <div className="p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${main.status === "in_progress" ? "text-white/65" : "text-[var(--color-text-muted)]"}`}>Turno de hoy</p>
              <h2 className={`mt-1 text-xl font-semibold ${main.status === "in_progress" ? "text-white" : "text-[var(--color-navy-900)]"}`}>{recipientName(recipientById[main.care_recipient_id ?? ""])}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${main.assignment_response_status === "pending" ? "bg-amber-100 text-amber-800" : main.status === "in_progress" ? "bg-white/15 text-white" : "bg-[var(--color-sage-100)] text-[var(--color-navy-900)]"}`}>{shiftLabel(main)}</span>
          </div>
          <div className={`flex items-center justify-between border-t pt-4 ${main.status === "in_progress" ? "border-white/15" : "border-[var(--color-border)]"}`}>
            <div><p className={`text-xs ${main.status === "in_progress" ? "text-white/60" : "text-[var(--color-text-muted)]"}`}>Horario</p><p className="mt-1 font-medium">{windowLabel(main)}</p></div>
            <ChevronRight size={21} aria-hidden />
          </div>
        </div>
      </Card>
    </Link> : <EmptyState title="No tienes turno hoy" description="Tu próximo turno aparecerá aquí cuando esté programado." />}

    {upcoming.length > 0 && <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-[var(--color-navy-900)]">Próximos turnos</h2>
        <Link to="/caregiver/shifts" className="text-sm font-medium text-[var(--color-accent-700)]">Ver todos</Link>
      </div>
      <Card className="divide-y divide-[var(--color-border)] p-0">
        {upcoming.map((shift) => <Link key={shift.id} to={`/caregiver/shifts/${shift.id}`} className="flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-ivory-100)] text-[var(--color-navy-900)]"><CalendarDays size={19}/></span>
          <div className="min-w-0 flex-1"><p className="truncate font-medium text-[var(--color-text-primary)]">{recipientName(recipientById[shift.care_recipient_id ?? ""])}</p><p className="text-sm text-[var(--color-text-secondary)]">{new Date(shift.scheduled_start).toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" })} · {windowLabel(shift)}</p></div>
          <ChevronRight size={18} className="text-[var(--color-text-muted)]"/>
        </Link>)}
      </Card>
    </section>}
  </div>;
}
