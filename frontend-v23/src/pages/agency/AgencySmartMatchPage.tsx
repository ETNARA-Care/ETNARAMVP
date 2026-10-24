import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarPlus, CheckCircle2, History, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  cancelOpportunity as cancelOpportunityApi, listOpportunityHistory, type OpportunityHistoryEvent, createOpportunityDraft, decideApplication, type CancellationReason, getApplicationReview, listAgencyOpportunities, listDecisionHistory,
  listPendingCounts, listReviewQueue, publishOpportunity,
  type AgencyOpportunity, type ApplicationReview, type DecisionEvent, type ReviewQueueItem,
} from "@/api/smartmatch";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { PUERTO_RICO_MUNICIPALITIES } from "@/features/smartmatch/municipalities";
import {
  applicationLabel, CANCELLATION_REASONS, EVENT_LABELS, OPPORTUNITY_EVENT_LABELS, formatDateTime, formatWindow, opportunityLabel, REASON_LABELS, ROLE_OPTIONS, roleLabelProblem, shiftLinkLabel, smartMatchErrorMessage,
} from "@/features/smartmatch/smartmatchText";

const CHECK_ROWS: { key: "membershipActive" | "credentialsEligible" | "availabilityConfigured" | "availabilityCovers" | "noUnavailabilityConflict" | "noScheduleConflict" | "consentRecorded" | "opportunityOpen"; label: string }[] = [
  { key: "membershipActive", label: "Membresía activa en la agencia" },
  { key: "credentialsEligible", label: "Credenciales obligatorias vigentes y verificadas" },
  { key: "availabilityConfigured", label: "Disponibilidad declarada" },
  { key: "availabilityCovers", label: "Su disponibilidad cubre el horario" },
  { key: "noUnavailabilityConflict", label: "Sin ausencias registradas en ese horario" },
  { key: "noScheduleConflict", label: "Sin otro turno ni visita aprobada en ese horario" },
  { key: "consentRecorded", label: "Consentimiento registrado" },
  { key: "opportunityOpen", label: "La oportunidad sigue abierta" },
];

function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * SmartMatch del administrador: la agencia publica oportunidades internas y
 * decide sobre las solicitudes. Cualquier administrador de la agencia puede
 * publicar borradores. Aprobar marca la oportunidad como cubierta; el turno
 * real se crea después, en el módulo de Turnos existente
 * («Crear turno con esta cuidadora»), donde se elige a la persona atendida.
 */
export function AgencySmartMatchPage() {
  const { activeOrganization, roles, user } = useAuth();
  const organizationId = activeOrganization?.id;
  const isAdmin = roles.includes("ORGANIZATION_ADMIN");
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const createShiftFor = (opportunityId: string) => navigate(`/agency/shifts?create=1&smartmatch=${opportunityId}`);
  const [approvedFor, setApprovedFor] = useState<{ opportunityId: string; name: string } | null>(null);
  // Gate 6: cancel a FILLED opportunity (reason required; never touches the Turnos shift).
  const [cancelTarget, setCancelTarget] = useState<AgencyOpportunity | null>(null);
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("");
  const [cancelNote, setCancelNote] = useState("");

  const [items, setItems] = useState<AgencyOpportunity[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(() => {
    const start = new Date(Date.now() + 24 * 3600_000); start.setMinutes(0, 0, 0);
    return { regionLabel: "", roleChoice: ROLE_OPTIONS[0] as string, roleOther: "", startsAt: localInput(start), endsAt: localInput(new Date(start.getTime() + 4 * 3600_000)) };
  });
  const [formError, setFormError] = useState("");

  const [queueFor, setQueueFor] = useState<AgencyOpportunity | null>(null);
  const [queue, setQueue] = useState<ReviewQueueItem[] | null>(null);
  const [review, setReview] = useState<ApplicationReview | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [history, setHistory] = useState<{ name: string; events: DecisionEvent[] } | null>(null);
  // Migration 109: append-only status history of one opportunity.
  const [oppHistory, setOppHistory] = useState<{ title: string; events: OpportunityHistoryEvent[] } | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !isAdmin) return;
    setLoadError(false);
    try {
      const [opps, pending] = await Promise.all([listAgencyOpportunities(organizationId, token), listPendingCounts(organizationId, token)]);
      setItems(opps);
      setCounts(Object.fromEntries(pending.map((c) => [c.opportunity_id, c.pending_count])));
    } catch { setLoadError(true); setItems([]); }
  }, [organizationId, isAdmin]);
  useEffect(() => { void load(); }, [load]);

  // Links from notifications and the dashboard: ?application=<id> opens the review,
  // ?opportunity=<id> opens that opportunity's applications. Params are consumed once.
  useEffect(() => {
    const applicationId = searchParams.get("application");
    const opportunityId = searchParams.get("opportunity");
    if (!applicationId && !(opportunityId && items)) return;
    if (applicationId) void openReview(applicationId);
    else if (opportunityId) {
      const opp = items?.find((o) => o.id === opportunityId);
      if (opp) void openQueue(opp);
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items]);

  const groups = useMemo(() => {
    const all = items ?? [];
    return {
      drafts: all.filter((o) => o.status === "DRAFT"),
      published: all.filter((o) => o.status === "PUBLISHED"),
      filled: all.filter((o) => o.status === "FILLED"),
      closed: all.filter((o) => o.status === "CANCELLED" || o.status === "EXPIRED"),
    };
  }, [items]);

  async function submitDraft(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!organizationId || !token) return;
    const roleLabel = form.roleChoice === "Otro" ? form.roleOther.trim() : form.roleChoice;
    if (!form.regionLabel) { setFormError("Selecciona un municipio."); return; }
    const roleProblem = roleLabelProblem(roleLabel);
    if (roleProblem) { setFormError(roleProblem); return; }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) { setFormError("La hora de fin debe ser posterior al inicio."); return; }
    if (new Date(form.startsAt) <= new Date()) { setFormError("El inicio debe ser en el futuro."); return; }
    setBusy(true); setFormError("");
    try {
      await createOpportunityDraft(organizationId, {
        regionLabel: form.regionLabel, roleLabel,
        startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(),
      }, token);
      show("Borrador guardado. Cualquier administrador de la agencia puede publicarlo.", "success");
      setCreateOpen(false); setForm((f) => ({ ...f, roleOther: "" }));
    } catch (e) { setFormError(smartMatchErrorMessage(e, "No se pudo guardar el borrador.")); }
    finally { setBusy(false); await load(); }
  }

  async function publish(opp: AgencyOpportunity) {
    const token = getToken();
    if (!organizationId || !token) return;
    setBusy(true);
    try { await publishOpportunity(organizationId, opp.id, token); show("Oportunidad publicada para los cuidadores de la agencia.", "success"); }
    catch (e) { show(smartMatchErrorMessage(e, "No se pudo publicar."), "danger"); }
    finally { setBusy(false); await load(); }
  }

  async function openQueue(opp: AgencyOpportunity) {
    const token = getToken();
    if (!organizationId || !token) return;
    setQueueFor(opp); setQueue(null);
    try { setQueue(await listReviewQueue(organizationId, opp.id, token)); }
    catch (e) { show(smartMatchErrorMessage(e, "No se pudieron cargar las solicitudes."), "danger"); setQueue([]); }
  }

  async function openReview(applicationId: string) {
    const token = getToken();
    if (!organizationId || !token) return;
    setReview(null); setConfirmApprove(false); setConfirmReject(false);
    try { setReview(await getApplicationReview(organizationId, applicationId, token)); }
    catch (e) { show(smartMatchErrorMessage(e, "No se pudo cargar la revisión."), "danger"); }
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    const token = getToken();
    if (!organizationId || !token || !review) return;
    setBusy(true);
    try {
      const result = await decideApplication(organizationId, review.application.id, decision, token);
      show(decision === "APPROVE"
        ? `Solicitud aprobada. La oportunidad quedó cubierta${result.closedApplications ? ` y se cerraron ${result.closedApplications} solicitudes pendientes` : ""}.`
        : "Solicitud rechazada.", "success");
      if (decision === "APPROVE" && result.outcome === "APPROVED") {
        setApprovedFor({ opportunityId: review.opportunity.id, name: review.caregiver.displayName ?? "la cuidadora" });
        setQueueFor(null);
      }
      setReview(null);
    } catch (e) {
      show(smartMatchErrorMessage(e, "No se pudo registrar la decisión."), "danger");
      await openReview(review.application.id);
    } finally {
      setBusy(false); setConfirmApprove(false); setConfirmReject(false);
      if (queueFor) await openQueue(queueFor);
      await load();
    }
  }

  async function cancelOpportunity() {
    const token = getToken();
    if (!organizationId || !token || !cancelTarget || !cancelReason) return;
    setBusy(true);
    try {
      const result = await cancelOpportunityApi(organizationId, cancelTarget.id, cancelReason, cancelNote, token);
      const n = result.closedApplications ?? 0;
      show(result.previousStatus === "PUBLISHED"
        ? (n === 0 ? "Oportunidad cancelada. No había solicitudes pendientes." : `Oportunidad cancelada. Cerramos ${n === 1 ? "1 solicitud pendiente" : `${n} solicitudes pendientes`} y avisamos a ${n === 1 ? "la cuidadora" : "cada cuidadora"}.`)
        : "Oportunidad cancelada. Avisamos a la cuidadora aprobada.", "success");
      setCancelTarget(null);
    } catch (e) { show(smartMatchErrorMessage(e, "No se pudo cancelar la oportunidad."), "danger"); }
    finally { setBusy(false); await load(); }
  }

  async function openOpportunityHistory(opp: AgencyOpportunity) {
    const token = getToken();
    if (!organizationId || !token) return;
    try { setOppHistory({ title: `${opp.role_label} · ${opp.region_label}`, events: await listOpportunityHistory(organizationId, opp.id, token) }); }
    catch (e) { show(smartMatchErrorMessage(e, "No se pudo cargar el historial."), "danger"); }
  }

  async function openHistory(item: ReviewQueueItem) {
    const token = getToken();
    if (!organizationId || !token) return;
    try { setHistory({ name: item.display_name ?? "Cuidador/a", events: await listDecisionHistory(organizationId, item.id, token) }); }
    catch (e) { show(smartMatchErrorMessage(e, "No se pudo cargar el historial."), "danger"); }
  }

  if (!isAdmin) return <ErrorState kind="permission" />;

  const opportunityCard = (opp: AgencyOpportunity) => {
    const status = opportunityLabel(opp.status);
    const pending = counts[opp.id] ?? 0;
    const link = shiftLinkLabel(opp);
    return <Card key={opp.id} className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{opp.role_label} · {opp.region_label}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatWindow(opp.starts_at, opp.ends_at)}</p>
          {opp.status === "PUBLISHED" && <p className="mt-1 text-sm">Solicitudes pendientes: <strong>{pending}</strong></p>}
        </div>
        {/* A filled opportunity shows its Turnos state instead of a second "Cubierta" badge. */}
        {link ? <span data-testid="shift-link-status"><Badge tone={link.tone}>{link.label}</Badge></span> : <Badge tone={status.tone}>{status.label}</Badge>}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {opp.status === "DRAFT" && <Button disabled={busy} onClick={() => void publish(opp)}>Publicar</Button>}
        {opp.status === "FILLED" && !opp.shift_id && <Button icon={<CalendarPlus size={18} />} onClick={() => createShiftFor(opp.id)}>Crear turno con esta cuidadora</Button>}
        {opp.status === "FILLED" && opp.shift_id && <Button variant="secondary" onClick={() => navigate(`/agency/shifts/${opp.shift_id}`)}>Ver turno</Button>}
        {(opp.status === "FILLED" || opp.status === "PUBLISHED") && <Button variant="ghost" onClick={() => { setCancelReason(""); setCancelNote(""); setCancelTarget(opp); }}>Cancelar oportunidad</Button>}
        {opp.status !== "DRAFT" && <Button variant="secondary" onClick={() => void openQueue(opp)}>
          {opp.status === "PUBLISHED" ? "Revisar solicitudes" : "Ver solicitudes e historial"}
        </Button>}
        {opp.status !== "DRAFT" && <Button variant="ghost" icon={<History size={18} />} onClick={() => void openOpportunityHistory(opp)}>Historial de la oportunidad</Button>}
      </div>
    </Card>;
  };

  const section = (title: string, list: AgencyOpportunity[], empty: string) => <section className="space-y-3" aria-label={title}>
    <h2 className="text-lg font-semibold">{title} <span className="text-[var(--color-text-muted)]">({list.length})</span></h2>
    {list.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">{empty}</p> : list.map(opportunityCard)}
  </section>;

  return <div className="space-y-6">
    <PageHeader title="SmartMatch"
      description="Oportunidades internas de tu agencia."
      actions={<Button icon={<Plus size={18} />} onClick={() => { setFormError(""); setCreateOpen(true); }}>Nueva oportunidad</Button>} />

    <p className="-mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
      <ShieldCheck size={14} aria-hidden /> Solo municipio, función y horario. Sin datos de pacientes.
    </p>
    {loadError && <ErrorState kind="network" onRetry={() => void load()} />}
    {items === null && !loadError && <><Skeleton className="h-24" /><Skeleton className="h-24" /></>}
    {items !== null && !loadError && items.length === 0 && <EmptyState title="Sin oportunidades"
      description="Crea un borrador. Cualquier administrador de la agencia puede publicarlo." action={{ label: "Nueva oportunidad", onClick: () => setCreateOpen(true) }} />}
    {items !== null && items.length > 0 && <>
      {section("Publicadas", groups.published, "No hay oportunidades publicadas.")}
      {section("Borradores", groups.drafts, "No hay borradores.")}
      {section("Cubiertas", groups.filled, "Todavía no hay oportunidades cubiertas.")}
      {groups.closed.length > 0 && section("Canceladas o vencidas", groups.closed, "")}
    </>}

    <Modal open={createOpen} onClose={() => !busy && setCreateOpen(false)} title="Nueva oportunidad (borrador)"
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={() => setCreateOpen(false)}>Cancelar</Button>
        <Button type="submit" form="smartmatch-draft" loading={busy}>Guardar borrador</Button>
      </div>}>
      <form id="smartmatch-draft" className="space-y-3" onSubmit={(e) => void submitDraft(e)}>
        <Select label="Municipio" required value={form.regionLabel} onChange={(e) => setForm({ ...form, regionLabel: e.target.value })}>
          <option value="">Selecciona un municipio</option>
          {PUERTO_RICO_MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select label="Función requerida" required value={form.roleChoice} onChange={(e) => setForm({ ...form, roleChoice: e.target.value })}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          <option value="Otro">Otro…</option>
        </Select>
        {form.roleChoice === "Otro" && <Input label="Describe la función" required maxLength={60} value={form.roleOther}
          hint="Solo el puesto (ej.: Acompañante bilingüe). Sin nombres, teléfonos ni direcciones."
          error={form.roleOther ? roleLabelProblem(form.roleOther) ?? undefined : undefined}
          onChange={(e) => setForm({ ...form, roleOther: e.target.value })} />}
        <Input label="Inicio" type="datetime-local" required value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        <Input label="Fin" type="datetime-local" required value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        {form.startsAt && form.endsAt && new Date(form.endsAt) > new Date(form.startsAt) &&
          <p className="rounded-xl bg-[var(--color-ivory-100)] p-3 text-sm" aria-live="polite">
            Se publicará como: <strong>{formatWindow(new Date(form.startsAt).toISOString(), new Date(form.endsAt).toISOString())}</strong>
          </p>}
        {formError && <p role="alert" className="text-sm text-[var(--color-danger-700)]">{formError}</p>}
        <p className="text-xs text-[var(--color-text-muted)]">Después de publicar, el horario, el municipio y la función ya no se pueden cambiar.</p>
      </form>
    </Modal>

    <Modal open={queueFor !== null && review === null && history === null} onClose={() => setQueueFor(null)}
      title={queueFor ? `Solicitudes · ${queueFor.role_label}, ${queueFor.region_label}` : "Solicitudes"}>
      {queue === null && <Skeleton className="h-20" />}
      {queue !== null && queue.length === 0 && <p className="text-sm">Todavía no hay solicitudes.</p>}
      <ul className="space-y-2">
        {(queue ?? []).map((item) => {
          const status = applicationLabel(item.status, item.decision_reason);
          return <li key={item.id} className="rounded-xl border border-[var(--color-border)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><p className="font-medium">{item.display_name ?? "Cuidador/a"}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Enviada {formatDateTime(item.created_at)}</p></div>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              {item.status === "PENDING" && <Button size="md" onClick={() => void openReview(item.id)}>Revisar</Button>}
              <Button size="md" variant="ghost" icon={<History size={16} />} onClick={() => void openHistory(item)}>Historial</Button>
            </div>
          </li>;
        })}
      </ul>
    </Modal>

    <Modal open={review !== null} onClose={() => !busy && setReview(null)} title={`Revisión · ${review?.caregiver.displayName ?? "Cuidador/a"}`}
      footer={review && review.application.status === "PENDING" && <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {!confirmApprove && !confirmReject && <>
          <Button variant="danger" disabled={busy} onClick={() => setConfirmReject(true)}>Rechazar</Button>
          <Button disabled={busy || !review.checks.approvable} onClick={() => setConfirmApprove(true)}>Aprobar</Button>
        </>}
        {confirmApprove && <>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmApprove(false)}>Volver</Button>
          <Button loading={busy} onClick={() => void decide("APPROVE")}>Confirmar aprobación</Button>
        </>}
        {confirmReject && <>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirmReject(false)}>Volver</Button>
          <Button variant="danger" loading={busy} onClick={() => void decide("REJECT")}>Confirmar rechazo</Button>
        </>}
      </div>}>
      {review && <div className="space-y-3 text-sm">
        <p>{formatWindow(review.opportunity.startsAt, review.opportunity.endsAt)}</p>
        {review.application.status !== "PENDING" && <p role="status" className="rounded-xl border border-[var(--color-border)] p-3">
          Esta solicitud ya está <strong>{applicationLabel(review.application.status, review.application.decisionReason).label.toLowerCase()}</strong>
          {review.application.decidedAt ? ` (${formatDateTime(review.application.decidedAt)})` : ""}. No requiere acción.
        </p>}
        <ul className="space-y-1.5" aria-label="Requisitos verificados">
          {CHECK_ROWS.filter((row) => review.checks[row.key] !== undefined).map((row) => <li key={row.key} data-check={row.key} className="flex items-start gap-2">
            {review.checks[row.key]
              ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--color-success-700)]" aria-label="Cumple" />
              : <XCircle size={18} className="mt-0.5 shrink-0 text-[var(--color-danger-700)]" aria-label="No cumple" />}
            <span>{row.label}</span>
          </li>)}
        </ul>
        {!review.checks.credentialsVerifiable && review.checks.membershipActive &&
          <p className="text-[var(--color-danger-700)]">No hay una política de credenciales aplicable: no se puede verificar.</p>}
        {review.checks.unmetRequirementCodes.length > 0 &&
          <p>Credenciales pendientes: <strong>{review.checks.unmetRequirementCodes.join(", ")}</strong></p>}
        {review.application.status === "PENDING" && !review.checks.approvable && <p role="status" className="rounded-xl bg-[var(--color-warning-50,#fff7e6)] p-3">
          La aprobación está bloqueada hasta que todos los requisitos se puedan verificar.
        </p>}
        {confirmApprove && <p role="alert" className="rounded-xl border border-[var(--color-border)] p-3">
          Al aprobar, la oportunidad quedará cubierta y las demás solicitudes pendientes se cerrarán. El turno se crea en el siguiente paso, en Turnos.
        </p>}
        {confirmReject && <p role="alert" className="rounded-xl border border-[var(--color-border)] p-3">¿Confirmas que deseas rechazar esta solicitud?</p>}
      </div>}
    </Modal>

    <Modal open={approvedFor !== null} onClose={() => setApprovedFor(null)} title="Solicitud aprobada"
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => setApprovedFor(null)}>Más tarde</Button>
        <Button icon={<CalendarPlus size={18} />} onClick={() => approvedFor && createShiftFor(approvedFor.opportunityId)}>Crear turno con esta cuidadora</Button>
      </div>}>
      <div className="space-y-2 text-sm">
        <p>La oportunidad quedó <strong>cubierta</strong> por {approvedFor?.name}.</p>
        <p>Crea el turno en Turnos: eliges a la persona atendida de tu agencia y añades instrucciones privadas. Si lo dejas para después, verás «Cubierta — pendiente de asignación» y el botón seguirá disponible.</p>
      </div>
    </Modal>

    <Modal open={cancelTarget !== null} onClose={() => !busy && setCancelTarget(null)}
      title={cancelTarget?.status === "PUBLISHED" ? "Cancelar oportunidad publicada" : "Cancelar oportunidad cubierta"}
      footer={<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={() => setCancelTarget(null)}>Volver</Button>
        {!(cancelTarget?.shift_id && cancelTarget.shift_status !== "cancelled") &&
          <Button variant="danger" loading={busy} disabled={!cancelReason} onClick={() => void cancelOpportunity()}>Cancelar oportunidad</Button>}
      </div>}>
      {cancelTarget?.shift_id && cancelTarget.shift_status !== "cancelled" ? <div className="space-y-3 text-sm">
        <p role="status">Esta oportunidad tiene un <strong>turno activo</strong> en Turnos. SmartMatch no cancela ni reasigna turnos reales.</p>
        <p>Primero decide en Turnos: cancela el turno o reasígnalo. Después podrás cancelar la oportunidad aquí.</p>
        <Button variant="secondary" fullWidth onClick={() => navigate(`/agency/shifts/${cancelTarget.shift_id}`)}>Ir al turno</Button>
      </div> : <div className="space-y-3">
        <Select label="Motivo" required value={cancelReason} onChange={(e) => setCancelReason(e.target.value as CancellationReason)}>
          <option value="">Selecciona un motivo</option>
          {(Object.keys(CANCELLATION_REASONS) as CancellationReason[]).map((r) => <option key={r} value={r}>{CANCELLATION_REASONS[r]}</option>)}
        </Select>
        <Input label="Nota interna (opcional)" maxLength={300} value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} hint="No se envía a la cuidadora." />
        {cancelTarget?.status === "PUBLISHED"
          ? <p className="text-sm" role="status">{(counts[cancelTarget.id] ?? 0) === 0
              ? "No hay solicitudes pendientes. La oportunidad dejará de mostrarse a las cuidadoras."
              : `Se cerrarán ${(counts[cancelTarget.id] ?? 0) === 1 ? "1 solicitud pendiente" : `${counts[cancelTarget.id]} solicitudes pendientes`}. Cada cuidadora recibirá un aviso con el motivo (sin la nota interna).`}
              {" "}El historial se conserva.</p>
          : <p className="text-xs text-[var(--color-text-muted)]">La cuidadora aprobada recibirá un aviso con el motivo. El historial se conserva.</p>}
      </div>}
    </Modal>

    <Modal open={oppHistory !== null} onClose={() => setOppHistory(null)} title={`Historial · ${oppHistory?.title ?? ""}`}>
      <ol className="space-y-2 text-sm" aria-label="Historial de la oportunidad">
        {(oppHistory?.events ?? []).map((ev, i) => <li key={i} className="rounded-xl border border-[var(--color-border)] p-3">
          <p className="font-medium">{OPPORTUNITY_EVENT_LABELS[ev.eventType] ?? ev.eventType}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(ev.occurredAt)} · {ev.automatic ? "Automático (sistema)" : ev.actorName ?? "Administración"}</p>
          {ev.reason && <p className="mt-1">Motivo: {CANCELLATION_REASONS[ev.reason] ?? ev.reason}</p>}
          {ev.closedApplications > 0 && <p className="mt-1">{ev.closedApplications === 1 ? "1 solicitud pendiente cerrada" : `${ev.closedApplications} solicitudes pendientes cerradas`} (cuidadoras avisadas)</p>}
        </li>)}
      </ol>
    </Modal>

    <Modal open={history !== null} onClose={() => setHistory(null)} title={`Historial · ${history?.name ?? ""}`}>
      <ol className="space-y-2 text-sm">
        {(history?.events ?? []).map((ev, i) => <li key={i} className="rounded-xl border border-[var(--color-border)] p-3">
          <p className="font-medium">{EVENT_LABELS[ev.event_type] ?? ev.event_type}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(ev.occurred_at)} · {ev.actor_user_id && ev.actor_user_id === user?.id ? "Tú" : ev.event_type === "SUBMITTED" || ev.event_type === "WITHDRAWN" ? "Cuidador/a" : "Administración"}</p>
          {ev.decision_reason && <p className="mt-1">{REASON_LABELS[ev.decision_reason] ?? ev.decision_reason}</p>}
        </li>)}
      </ol>
    </Modal>
  </div>;
}
