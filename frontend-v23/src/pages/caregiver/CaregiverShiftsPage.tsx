import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, Clock3, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listCareRecipients, listMyShifts, recipientName, type CareRecipient, type Shift } from "@/api/shifts";
import { listMyCoverageOffers, respondCoverageOffer, type MyCoverageOffer } from "@/api/coverageOffers";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge, useToast } from "@/components/ui";

function formatWindow(shift: Pick<Shift, "scheduled_start" | "scheduled_end">): string {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" })} · ${start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`;
}
function formatResponseDeadline(value: string): string {
  return new Date(value).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
}

export function CaregiverShiftsPage() {
  const { activeOrganization } = useAuth();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [offers, setOffers] = useState<MyCoverageOffer[]>([]);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { show } = useToast();
  const organizationId = activeOrganization?.id;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const [shiftRows, recipientRows, offerRows] = await Promise.all([
        listMyShifts(organizationId, token),
        listCareRecipients(organizationId, token),
        listMyCoverageOffers(organizationId, token),
      ]);
      setShifts(shiftRows); setRecipients(recipientRows); setOffers(offerRows);
    } catch { setError(true); setShifts([]); }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const recipientById = useMemo(() => Object.fromEntries(recipients.map((item) => [item.id, item])), [recipients]);
  const ordered = useMemo(() => [...(shifts ?? [])].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()), [shifts]);
  const open = ordered.filter((shift) => shift.status !== "completed" && shift.status !== "cancelled");
  const completed = ordered.filter((shift) => shift.status === "completed");

  async function answerOffer(offer: MyCoverageOffer, decision: "interested" | "declined") {
    const token = getToken();
    if (!organizationId || !token) return;
    const prompt = decision === "interested"
      ? "¿Confirmas que deseas indicar que estás disponible? Administración tomará la decisión final."
      : "¿Confirmas que no estás disponible para este turno?";
    if (!window.confirm(prompt)) return;
    setRespondingOfferId(offer.id);
    try {
      await respondCoverageOffer(organizationId, offer.id, decision, token);
      show(decision === "interested" ? "Informamos a Administración que estás disponible." : "Respuesta guardada.", "success");
      await load();
    } catch { show("No pudimos guardar tu respuesta.", "danger"); }
    finally { setRespondingOfferId(null); }
  }

  if (shifts === null) return <div className="flex flex-col gap-4"><Skeleton className="h-20"/><Skeleton className="h-36"/><Skeleton className="h-24"/></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  const shiftCard = (shift: Shift) => (
    <Link key={shift.id} to={`/caregiver/shifts/${shift.id}`} className="block">
      <Card className="flex items-center gap-4 border-[var(--color-border)] bg-white p-4 transition-shadow hover:shadow-[var(--shadow-card)]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-ivory-100)] text-[var(--color-navy-900)]"><CalendarDays size={20}/></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--color-navy-900)]">{recipientName(recipientById[shift.care_recipient_id ?? ""])}</p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{formatWindow(shift)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {shift.assignment_response_status === "pending" ? <Badge tone="warning">Responder</Badge> : <StatusBadge status={shift.status}/>}
          <ChevronRight size={18} className="text-[var(--color-text-muted)]"/>
        </div>
      </Card>
    </Link>
  );

  return <div className="flex flex-col gap-7">
    <header>
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Agenda</p>
      <h1 className="mt-1 font-[var(--font-display)] text-3xl text-[var(--color-navy-900)]">Turnos</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Tus asignaciones y oportunidades de cobertura.</p>
    </header>

    {offers.length > 0 && <section>
      <div className="mb-3 flex items-center gap-2"><Clock3 size={18} className="text-[var(--color-accent-700)]"/><h2 className="font-semibold text-[var(--color-navy-900)]">Turnos disponibles</h2></div>
      <div className="flex flex-col gap-3">
        {offers.map((offer) => <Card key={offer.id} className="overflow-hidden border-[var(--color-border)] bg-white p-0">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--color-navy-900)]">Oportunidad de turno</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatWindow({ scheduled_start: offer.scheduledStart, scheduled_end: offer.scheduledEnd })}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><ShieldCheck size={14}/> {offer.roleLabel} · sin información clínica hasta la asignación</p>
                {offer.responseStatus === "pending" && offer.responseDueAt && <p className="mt-2 text-xs font-medium text-[var(--color-accent-700)]">Responde antes de las {formatResponseDeadline(offer.responseDueAt)}</p>}
              </div>
              <Badge tone={offer.responseStatus === "interested" ? "success" : offer.responseStatus === "declined" ? "neutral" : "accent"}>{offer.responseStatus === "interested" ? "Disponible" : offer.responseStatus === "declined" ? "No disponible" : "Nueva"}</Badge>
            </div>
          </div>
          {offer.responseStatus === "pending" && <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] bg-[var(--color-ivory-50)] p-3">
            <Button onClick={() => void answerOffer(offer, "interested")} loading={respondingOfferId === offer.id}>Estoy disponible</Button>
            <Button variant="secondary" onClick={() => void answerOffer(offer, "declined")} disabled={respondingOfferId === offer.id}>No disponible</Button>
          </div>}
        </Card>)}
      </div>
    </section>}

    <section>
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-[var(--color-navy-900)]">Asignados</h2>{open.length > 0 && <span className="text-xs text-[var(--color-text-muted)]">{open.length} activo{open.length === 1 ? "" : "s"}</span>}</div>
      <div className="flex flex-col gap-3">{open.length > 0 ? open.map(shiftCard) : <EmptyState title="No tienes turnos asignados" description="Cuando Administración te asigne uno, aparecerá aquí."/>}</div>
    </section>

    {completed.length > 0 && <section>
      <h2 className="mb-3 font-semibold text-[var(--color-navy-900)]">Completados</h2>
      <div className="flex flex-col gap-3">{completed.map(shiftCard)}</div>
    </section>}
  </div>;
}
