import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  applyToOpportunity, listAvailableOpportunities, listMyApplications, withdrawApplication,
  type AvailableOpportunity, type MyApplication,
} from "@/api/smartmatch";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Modal, Select, Skeleton, Tabs, useToast } from "@/components/ui";
import { PUERTO_RICO_MUNICIPALITIES } from "@/features/smartmatch/municipalities";
import { applicationLabel, formatDateTime, formatWindow, smartMatchErrorMessage } from "@/features/smartmatch/smartmatchText";

/**
 * SmartMatch del cuidador: oportunidades internas de su propia agencia.
 * La agencia siempre toma la decisión final; una aprobación todavía no crea
 * una asignación de turno. Sin datos de pacientes ni direcciones exactas.
 */
export function CaregiverSmartMatchPage() {
  const { activeOrganization, roles } = useAuth();
  const organizationId = activeOrganization?.id;
  const isCaregiver = roles.includes("WORKER");
  const { show } = useToast();

  const [available, setAvailable] = useState<AvailableOpportunity[] | null>(null);
  const [mine, setMine] = useState<MyApplication[]>([]);
  const [error, setError] = useState<"network" | "permission" | null>(null);
  const [municipality, setMunicipality] = useState("");
  const [searchParams] = useSearchParams();
  // From a notification: ?tab=mine&application=<id> opens "Mis solicitudes" and highlights it.
  const [tab, setTab] = useState(searchParams.get("tab") === "mine" ? "mine" : "available");
  const highlightId = searchParams.get("application");
  const [applyTarget, setApplyTarget] = useState<AvailableOpportunity | null>(null);
  const [consent, setConsent] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<MyApplication | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !isCaregiver) return;
    setError(null);
    try {
      const [opps, apps] = await Promise.all([
        listAvailableOpportunities(organizationId, token),
        listMyApplications(organizationId, token),
      ]);
      setAvailable(opps); setMine(apps);
    } catch (e) {
      setError((e as { status?: number })?.status === 403 ? "permission" : "network");
      setAvailable([]);
    }
  }, [organizationId, isCaregiver]);
  useEffect(() => { void load(); }, [load]);

  // Latest application per opportunity decides what the caregiver can do next.
  const latestByOpportunity = useMemo(() => {
    const map = new Map<string, MyApplication>();
    for (const app of mine) {
      const current = map.get(app.opportunity_id);
      if (!current || new Date(app.created_at) > new Date(current.created_at)) map.set(app.opportunity_id, app);
    }
    return map;
  }, [mine]);
  const shown = (available ?? []).filter((o) => !municipality || o.region_label === municipality);

  async function confirmApply() {
    const token = getToken();
    if (!organizationId || !token || !applyTarget || !consent) return;
    setBusy(true);
    try {
      await applyToOpportunity(organizationId, applyTarget.id, token);
      show("Solicitud enviada. La agencia revisará tu solicitud.", "success");
      setApplyTarget(null); setConsent(false); setTab("mine");
    } catch (e) {
      show(smartMatchErrorMessage(e, "No se pudo enviar la solicitud."), "danger");
    } finally { setBusy(false); await load(); }
  }

  async function confirmWithdraw() {
    const token = getToken();
    if (!organizationId || !token || !withdrawTarget) return;
    setBusy(true);
    try {
      await withdrawApplication(organizationId, withdrawTarget.id, token);
      show("Solicitud retirada. Puedes volver a solicitar mientras la oportunidad siga disponible.", "success");
      setWithdrawTarget(null);
    } catch (e) {
      show(smartMatchErrorMessage(e, "No se pudo retirar la solicitud."), "danger");
    } finally { setBusy(false); await load(); }
  }

  if (!isCaregiver) return <ErrorState kind="permission" />;

  return <div className="space-y-4">
    <div>
      <h1 className="text-2xl font-semibold">Oportunidades</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Servicios de {activeOrganization?.name ?? "tu agencia"}.</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]"><ShieldCheck size={14} aria-hidden /> Sin datos de pacientes ni direcciones exactas.</p>
    </div>

    <Tabs items={[{ id: "available", label: "Disponibles" }, { id: "mine", label: `Mis solicitudes${mine.length ? ` (${mine.length})` : ""}` }]}
      value={tab} onChange={setTab} />

    {error && <ErrorState kind={error} onRetry={() => void load()} />}

    {!error && tab === "available" && <section className="space-y-3" aria-label="Oportunidades disponibles">
      <Select label="Municipio" value={municipality} onChange={(e) => setMunicipality(e.target.value)}>
        <option value="">Todos los municipios</option>
        {PUERTO_RICO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
      </Select>
      <p className="text-xs text-[var(--color-text-muted)]">
        Tiempo de viaje: aún no disponible.
      </p>
      {available === null && <><Skeleton className="h-28" /><Skeleton className="h-28" /></>}
      {available !== null && shown.length === 0 && <EmptyState icon={<BriefcaseBusiness size={28} />}
        title="No hay oportunidades" description={municipality ? `No hay oportunidades publicadas en ${municipality}.` : "Tu agencia no tiene oportunidades publicadas ahora mismo."} />}
      {shown.map((opp) => {
        const latest = latestByOpportunity.get(opp.id);
        const open = latest && latest.status !== "WITHDRAWN";
        return <Card key={opp.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{opp.role_label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]"><MapPin size={15} />{opp.region_label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]"><CalendarDays size={15} />{formatWindow(opp.starts_at, opp.ends_at)}</p>
            </div>
            {open && <Badge tone={applicationLabel(latest.status, latest.decision_reason).tone}>{applicationLabel(latest.status, latest.decision_reason).label}</Badge>}
          </div>
          {!open && <Button className="mt-3" fullWidth onClick={() => { setConsent(false); setApplyTarget(opp); }}>
            {latest?.status === "WITHDRAWN" ? "Volver a solicitar" : "Solicitar oportunidad"}
          </Button>}
        </Card>;
      })}
    </section>}

    {!error && tab === "mine" && <section className="space-y-3" aria-label="Mis solicitudes">
      {mine.length === 0 && <EmptyState title="Aún no tienes solicitudes" description="Cuando solicites una oportunidad, verás aquí su estado." />}
      {mine.map((app) => {
        const status = applicationLabel(app.status, app.decision_reason);
        return <Card key={app.id} className={`p-4 ${app.id === highlightId ? "ring-2 ring-[var(--color-accent-700)]" : ""}`}
          aria-current={app.id === highlightId ? "true" : undefined}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{app.role_label} · {app.region_label}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatWindow(app.starts_at, app.ends_at)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Enviada {formatDateTime(app.created_at)}
                {app.withdrawn_at && ` · Retirada ${formatDateTime(app.withdrawn_at)}`}
                {app.decided_at && ` · Decidida ${formatDateTime(app.decided_at)}`}
              </p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {app.status === "APPROVED" && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            La agencia aprobó tu solicitud. Te contactará para confirmar el turno; aún no aparece como asignación.
          </p>}
          {app.status === "PENDING" && <Button className="mt-3" variant="secondary" fullWidth onClick={() => setWithdrawTarget(app)}>
            Retirar solicitud
          </Button>}
        </Card>;
      })}
    </section>}

    <Modal open={applyTarget !== null} onClose={() => !busy && setApplyTarget(null)} title="Solicitar oportunidad"
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={() => setApplyTarget(null)}>Cancelar</Button>
        <Button disabled={!consent} loading={busy} onClick={() => void confirmApply()}>Enviar solicitud</Button>
      </div>}>
      {applyTarget && <div className="space-y-3 text-sm">
        <p><strong>{applyTarget.role_label}</strong> · {applyTarget.region_label}<br />{formatWindow(applyTarget.starts_at, applyTarget.ends_at)}</p>
        <p className="text-[var(--color-text-secondary)]">
          Al solicitar, autorizas a {activeOrganization?.name ?? "tu agencia"} a revisar tu membresía, tus credenciales y tu disponibilidad declarada para decidir sobre esta oportunidad. La agencia toma la decisión final. Puedes retirar tu solicitud mientras esté pendiente.
        </p>
        <Checkbox label="Acepto y doy mi consentimiento" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      </div>}
    </Modal>

    <Modal open={withdrawTarget !== null} onClose={() => !busy && setWithdrawTarget(null)} title="Retirar solicitud"
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={() => setWithdrawTarget(null)}>Mantener</Button>
        <Button variant="danger" loading={busy} onClick={() => void confirmWithdraw()}>Retirar</Button>
      </div>}>
      <p className="text-sm">¿Confirmas que deseas retirar tu solicitud? Podrás volver a solicitar mientras la oportunidad siga disponible, con un nuevo consentimiento.</p>
    </Modal>
  </div>;
}
