import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listCareRecipients, listMyShifts, recipientName, type CareRecipient, type Shift } from "@/api/shifts";
import { listMyCoverageOffers, respondCoverageOffer, type MyCoverageOffer } from "@/api/coverageOffers";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge, useToast } from "@/components/ui";

function formatWindow(shift: Shift): string {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" })} · ${start.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}`;
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
      setShifts(shiftRows);
      setRecipients(recipientRows);
      setOffers(offerRows);
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
    } catch {
      show("No pudimos guardar tu respuesta.", "danger");
    } finally { setRespondingOfferId(null); }
  }

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
      {offers.length > 0 && <div>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-2">Turnos disponibles</p>
        <div className="flex flex-col gap-3">
          {offers.map((offer) => <Card key={offer.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-medium text-[var(--color-text-primary)]">Oportunidad de turno</p><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{formatWindow({ scheduled_start: offer.scheduledStart, scheduled_end: offer.scheduledEnd } as Shift)}</p><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{offer.roleLabel} · sin información clínica hasta la asignación</p></div>
              <Badge tone={offer.responseStatus === "interested" ? "success" : offer.responseStatus === "declined" ? "neutral" : "accent"}>{offer.responseStatus === "interested" ? "Disponible" : offer.responseStatus === "declined" ? "No disponible" : "Responder"}</Badge>
            </div>
            {offer.responseStatus === "pending" && <div className="grid grid-cols-2 gap-2"><Button onClick={() => void answerOffer(offer, "interested")} loading={respondingOfferId === offer.id}>Estoy disponible</Button><Button variant="secondary" onClick={() => void answerOffer(offer, "declined")} disabled={respondingOfferId === offer.id}>No disponible</Button></div>}
          </Card>)}
        </div>
      </div>}
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
