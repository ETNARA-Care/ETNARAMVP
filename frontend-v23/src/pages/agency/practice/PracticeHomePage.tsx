import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, HeartHandshake, MessageCircle, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { listCareRecipients, listShifts, recipientName, type CareRecipient, type Shift } from "@/api/shifts";
import { PRACTICE_STATUS_LABEL, practiceApi, type PracticeDocuments } from "@/api/practice";

/**
 * 160 (PR B): inicio de «Mi práctica». Solo datos propios de la organización independiente (clientes, turnos y el
 * resumen de requisitos de su propia ficha). Nada del centro operacional, cobertura ni personal (cerrados en el backend).
 */
export function PracticeHomePage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [clients, setClients] = useState<CareRecipient[]>([]);
  const [docs, setDocs] = useState<PracticeDocuments | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const [shiftRows, clientRows] = await Promise.all([listShifts(organizationId, token), listCareRecipients(organizationId, token)]);
      setShifts(shiftRows);
      setClients(clientRows);
    } catch {
      setError(true);
      setShifts([]);
    }
    practiceApi.documents(organizationId, token).then(setDocs).catch(() => setDocs(null));
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const today = new Date().toDateString();
  const todays = (shifts ?? []).filter((s) => s.status !== "cancelled" && new Date(s.scheduled_start).toDateString() === today);
  const unassigned = (shifts ?? []).filter((s) => s.status === "unassigned" && new Date(s.scheduled_end).getTime() > Date.now());
  const attention = (docs?.requirements ?? []).filter((r) => r.status !== "REGISTERED");

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="practice-home">
      <PageHeader title="Mi práctica" description={`Administras ${activeOrganization?.name ?? "tu práctica"} y prestas el servicio con la misma cuenta.`} />
      {shifts === null ? <Skeleton className="h-32" /> : error ? <ErrorState kind="server" onRetry={() => void load()} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Clientes activos</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{clients.length}</p></Card>
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Turnos de hoy</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{todays.length}</p></Card>
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Turnos sin asignar</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{unassigned.length}</p></Card>
          </div>
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Hoy</h2>
            {todays.length === 0 ? <p className="text-[var(--color-text-secondary)]">No tienes turnos hoy.</p> : (
              <ul className="flex flex-col gap-1">{todays.map((s) => (
                <li key={s.id} className="text-[var(--color-text-primary)]">{recipientName(clientById[s.care_recipient_id ?? ""])} · {new Date(s.scheduled_start).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}</li>
              ))}</ul>
            )}
          </Card>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button icon={<HeartHandshake size={18} />} onClick={() => navigate("/caregiver/today")}>Mi día de cuidador</Button>
            <Button variant="secondary" icon={<CalendarPlus size={18} />} onClick={() => navigate("/agency/shifts?create=1")}>Nuevo turno</Button>
            <Button variant="secondary" icon={<UserPlus size={18} />} onClick={() => navigate("/agency/residents")}>Clientes</Button>
            <Button variant="secondary" icon={<MessageCircle size={18} />} onClick={() => navigate("/agency/messages")}>Mensajes con familias</Button>
          </div>
          <Card data-testid="practice-documents-card" className="flex flex-col gap-1">
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Tus documentos de práctica</h2>
            {!docs ? <p className="text-[var(--color-text-secondary)]">—</p>
              : !docs.policyConfigured ? <p className="text-[var(--color-text-secondary)]">No has definido requisitos para tu práctica.</p>
              : attention.length === 0 ? <p className="text-[var(--color-text-secondary)]">Todos tus requisitos están registrados y vigentes.</p>
              : <ul className="list-disc pl-5 text-[var(--color-text-secondary)]">{attention.map((r) => <li key={r.credentialTypeCode}>{r.name}: {PRACTICE_STATUS_LABEL[r.status]}</li>)}</ul>}
            <Button size="sm" variant="secondary" onClick={() => navigate("/agency/documents")}>Mis documentos</Button>
            <p className="text-[length:var(--text-small)] text-[var(--color-text-muted)]">Cumplir los requisitos legales y profesionales de tu práctica es tu responsabilidad. ETNARA Care no verifica ni certifica documentos.</p>
          </Card>
        </>
      )}
    </div>
  );
}
