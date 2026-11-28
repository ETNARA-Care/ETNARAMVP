import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Tabs, Textarea, useToast } from "@/components/ui";
import {
  assignmentErrorMessage, assignmentsApi, SUBSTITUTION_REASONS, type BoardResident, type BoardStaff, type CoverageAlert, type HistoryPeriod,
  type HistorySubstitution, type ShiftBoard, type SubstitutionPreview, type SubstitutionReason,
} from "@/api/residentialAssignments";
import { scheduleApi, type ScheduleStaff } from "@/api/residentialSchedule";
import {
  defaultTransfers, puertoRicoLocalToIso, transfersBody, uncoveredAfterMoves, uncoveredAfterSubstitution,
} from "@/features/residential/assignments";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization, RESIDENTIAL_PANEL_PATH } from "@/features/residential/modality";
import { mondayOf, puertoRicoDate } from "@/features/residential/schedule";

/**
 * 176 (hogares F3): asignación de residentes por turno y sustitución administrativa. Solo hogares, solo administración,
 * solo con HOGAR_ASIGNACIONES; la sustitución, además, con HOGAR_CALENDARIO. El portal no decide nada: muestra lo que
 * calcula el backend (cobertura, bloqueos) y vuelve a leer tras cada cambio. Ningún motivo pide datos de salud.
 */
type Tab = "shifts" | "alerts";
type Data = { boards: ShiftBoard[]; alerts: CoverageAlert[] };
const fmt = (iso: string | null, lang: string | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" }) =>
  (iso ? new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico", ...opts }) : "—");
const time = (iso: string, lang: string | undefined) => fmt(iso, lang, { hour: "numeric", minute: "2-digit" });

export function ResidentialAssignmentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_ASIGNACIONES");
  const calendar = useOrgFeature("HOGAR_CALENDARIO");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("shifts");
  const [estState, setEstState] = useState<OrganizationScoped<Array<{ id: string; name: string }>> | null>(null);
  const [selected, setSelected] = useState<{ organizationId: string; locationId: string } | null>(null);
  const [date, setDate] = useState(() => puertoRicoDate());
  const [state, setState] = useState<OrganizationScoped<Data> | null>(null);
  const [dialogState, setDialogState] = useState<{ organizationId: string; dialog: ReactNode } | null>(null);
  const [busy, setBusy] = useState(false);
  const latestList = useRef(createLatestRequest());
  const latest = useRef(createLatestRequest());

  const loadEstablishments = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential || !enabled) return;
    const request = latestList.current.begin();
    try {
      const { establishments } = await assignmentsApi.establishments(organizationId, token);
      if (request.isCurrent()) setEstState({ organizationId, data: establishments, error: false });
    } catch {
      if (request.isCurrent()) setEstState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential, enabled]);
  useEffect(() => {
    const tracker = latestList.current;
    void loadEstablishments();
    return () => tracker.invalidate();
  }, [loadEstablishments]);
  const establishments = scopedTo(estState, organizationId)?.data ?? null;
  const listError = scopedTo(estState, organizationId)?.error === true;
  const chosen = selected && selected.organizationId === organizationId ? selected.locationId : null;
  const locationId = establishments?.some((e) => e.id === chosen) ? chosen : establishments?.[0]?.id ?? null;
  const key = locationId ? `${locationId}|${date}` : undefined;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !locationId || !residential || !enabled) return;
    const request = latest.current.begin();
    const k = `${locationId}|${date}`;
    try {
      const [day, alerts] = await Promise.all([assignmentsApi.day(organizationId, locationId, date, token), assignmentsApi.alerts(organizationId, token)]);
      if (request.isCurrent()) setState({ organizationId, key: k, error: false, data: { boards: day.boards, alerts: alerts.alerts } });
    } catch {
      if (request.isCurrent()) setState({ organizationId, key: k, data: null, error: true });
    }
  }, [organizationId, locationId, date, residential, enabled]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);
  const current = scopedTo(state, organizationId, key);
  const data = current?.data ?? null;
  const error = current?.error === true;
  const dialog = dialogState && dialogState.organizationId === organizationId ? dialogState.dialog : null;
  const open = (d: ReactNode) => organizationId && setDialogState({ organizationId, dialog: d });
  const close = () => setDialogState(null);

  /** Ejecuta un cambio, avisa y vuelve a leer (el backend es la fuente de verdad). */
  const run = async (fn: (o: string, token: string) => Promise<unknown>, ok: string) => {
    const token = getToken();
    if (!organizationId || !token) return false;
    setBusy(true);
    try { await fn(organizationId, token); toast.show(ok, "success"); close(); await load(); return true; }
    catch (e) { toast.show(assignmentErrorMessage(e), "danger"); await load(); return false; }
    finally { setBusy(false); }
  };

  if (!residential) return <Navigate to="/agency" replace />;
  if (!enabled) return <Navigate to={RESIDENTIAL_PANEL_PATH} replace />;

  const openAlerts = data?.alerts.filter((a) => !a.resolvedAt) ?? [];
  return (
    <div className="flex flex-col gap-6" data-testid="residential-assignments">
      <PageHeader title={t("assignments.title")} description={t("assignments.description")} />
      {listError ? <ErrorState kind="server" onRetry={() => { setEstState(null); void loadEstablishments(); }} /> : establishments === null ? <Skeleton className="h-32" /> : establishments.length === 0 ? (
        <EmptyState title={t("assignments.noEstablishmentsTitle")} description={t("assignments.noEstablishmentsDetail")} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {establishments.length > 1 && (
              <div className="w-full sm:w-[20rem]">
                <Select label={t("assignments.establishment")} value={locationId ?? ""} onChange={(e) => organizationId && setSelected({ organizationId, locationId: e.target.value })}>
                  {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </div>
            )}
            <div className="w-full sm:w-[12rem]"><Input type="date" label={t("assignments.date")} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></div>
          </div>
          <Tabs value={tab} onChange={(id) => setTab(id as Tab)} items={[
            { id: "shifts", label: t("assignments.tabs.shifts") },
            { id: "alerts", label: t("assignments.tabs.alerts", { count: openAlerts.length }) },
          ]} />
          {error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : !data ? <Skeleton className="h-64" /> : tab === "shifts" ? (
            data.boards.length === 0 ? <EmptyState title={t("assignments.noShiftsTitle")} description={t("assignments.noShiftsDetail")} /> : (
              <div className="flex flex-col gap-4">
                {data.boards.map((b) => (
                  <BoardCard key={b.shift.id} board={b} language={lang} busy={busy} substitutions={calendar}
                    onAssign={(s) => open(<AssignDialog board={b} staff={s} busy={busy} onClose={close}
                      onConfirm={(ids, at) => run((o, token) => assignmentsApi.assign(o, b.shift.id, { membershipId: s.membershipId, careRecipientIds: ids, effectiveAt: at }, token), t("assignments.toasts.assigned", { count: ids.length }))} />)}
                    onMove={(r) => open(<MoveDialog board={b} resident={r} busy={busy} onClose={close}
                      onConfirm={(body) => run((o, token) => assignmentsApi.redistribute(o, b.shift.id, body, token), t("assignments.toasts.moved"))} />)}
                    onSubstitute={(s) => organizationId && locationId && open(<SubstitutionDialog organizationId={organizationId} locationId={locationId} board={b} original={s} busy={busy} onClose={close}
                      onConfirm={(body) => run((o, token) => assignmentsApi.substitute(o, b.shift.id, body, token), t("assignments.toasts.substituted"))} />)}
                    onHistory={() => organizationId && open(<HistoryDialog organizationId={organizationId} shiftId={b.shift.id} onClose={close} />)} />
                ))}
              </div>
            )
          ) : (
            <AlertsList alerts={data.alerts} language={lang} busy={busy} onResolve={(a) => void run((o, token) => assignmentsApi.resolveAlert(o, a.id, token), t("assignments.toasts.resolved"))} />
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

function BoardCard({ board, language, busy, substitutions, onAssign, onMove, onSubstitute, onHistory }: {
  board: ShiftBoard; language: string | undefined; busy: boolean; substitutions: boolean;
  onAssign: (s: BoardStaff) => void; onMove: (r: BoardResident) => void; onSubstitute: (s: BoardStaff) => void; onHistory: () => void;
}) {
  const { t } = useTranslation("residential");
  const nameOf = (id: string) => board.staff.find((s) => s.membershipId === id)?.name ?? t("assignments.unnamed");
  const s = board.shift;
  return (
    <Card className="flex flex-col gap-4 p-[var(--spacing-md)]" data-testid="assignment-board">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{`${fmt(s.scheduledStart, language)} – ${time(s.scheduledEnd, language)}`}</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{`${s.establishment.name} · ${s.requiredRole}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">{t("assignments.totals.covered", { count: board.totals.covered })}</Badge>
          {board.totals.uncovered > 0 && <Badge tone="warning">{t("assignments.totals.uncovered", { count: board.totals.uncovered })}</Badge>}
          {board.totals.shared > 0 && <Badge tone="accent">{t("assignments.totals.shared", { count: board.totals.shared })}</Badge>}
          {s.ended && <Badge tone="neutral">{t("assignments.ended")}</Badge>}
          <Button variant="ghost" size="sm" onClick={onHistory}>{t("assignments.history.open")}</Button>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-[var(--text-small)] font-semibold uppercase text-[var(--color-text-secondary)]">{t("assignments.staffTitle")}</h3>
        {board.staff.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("assignments.noStaff")}</p> : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {board.staff.map((m) => (
              <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-[var(--color-text-primary)]">{m.name ?? t("assignments.unnamed")}</p>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                    {`${t("assignments.coverage", { from: time(m.coverageStart, language), to: time(m.coverageEnd, language) })} · ${t("assignments.residentCount", { count: m.residentCount })}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!m.accepted && <Badge tone="neutral">{t("assignments.notAccepted")}</Badge>}
                  <Button size="sm" variant="secondary" disabled={busy || s.ended || !m.accepted} onClick={() => onAssign(m)}>{t("assignments.assign.open")}</Button>
                  {substitutions && <Button size="sm" variant="ghost" disabled={busy || s.ended} onClick={() => onSubstitute(m)}>{t("assignments.substitution.open")}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-[var(--text-small)] font-semibold uppercase text-[var(--color-text-secondary)]">{t("assignments.residentsTitle")}</h3>
        {board.residents.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("assignments.noResidents")}</p> : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {board.residents.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="assignment-resident">
                <div>
                  <p className="text-[var(--color-text-primary)]">{r.name}{r.roomName ? <span className="text-[var(--color-text-secondary)]">{` · ${r.roomName}`}</span> : null}</p>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                    {r.coveredBy.length ? t("assignments.coveredBy", { names: r.coveredBy.map(nameOf).join(", ") }) : t("assignments.nobody")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.uncovered && <Badge tone="warning">{t("assignments.uncoveredBadge")}</Badge>}
                  {r.shared && <Badge tone="accent">{t("assignments.sharedBadge")}</Badge>}
                  {r.coveredBy.length > 0 && <Button size="sm" variant="ghost" disabled={busy || s.ended} onClick={() => onMove(r)}>{t("assignments.move.open")}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function WhenInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation("residential");
  return <Input type="datetime-local" label={t("assignments.when")} value={value} onChange={(e) => onChange(e.target.value)} hint={t("assignments.whenHint")} />;
}

function AssignDialog({ board, staff, busy, onClose, onConfirm }: { board: ShiftBoard; staff: BoardStaff; busy: boolean; onClose: () => void; onConfirm: (ids: string[], at?: string) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [ids, setIds] = useState<string[]>([]);
  const [when, setWhen] = useState("");
  const available = board.residents.filter((r) => !r.coveredBy.includes(staff.membershipId));
  const toggle = (id: string) => setIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <Modal open onClose={onClose} title={t("assignments.assign.title", { name: staff.name ?? t("assignments.unnamed") })} sheetOnMobile
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("assignments.cancel")}</Button>
        <Button disabled={busy || ids.length === 0} onClick={() => void onConfirm(ids, puertoRicoLocalToIso(when))}>{t("assignments.assign.confirm", { count: ids.length })}</Button></div>}>
      <div className="flex flex-col gap-3">
        <p className="text-[var(--color-text-secondary)]">{t("assignments.assign.body")}</p>
        {available.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("assignments.assign.none")}</p> : (
          <ul className="flex flex-col gap-2">
            {available.map((r) => (
              <li key={r.id}><label className="flex items-center gap-2 text-[var(--color-text-primary)]">
                <input type="checkbox" checked={ids.includes(r.id)} onChange={() => toggle(r.id)} />
                <span>{r.name}{r.uncovered ? ` · ${t("assignments.uncoveredBadge")}` : ""}</span>
              </label></li>
            ))}
          </ul>
        )}
        <WhenInput value={when} onChange={setWhen} />
      </div>
    </Modal>
  );
}

function UncoveredConfirm({ count, confirmed, reason, onConfirmed, onReason }: { count: number; confirmed: boolean; reason: string; onConfirmed: (v: boolean) => void; onReason: (v: string) => void }) {
  const { t } = useTranslation("residential");
  if (count === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)] p-3" data-testid="uncovered-confirm">
      <p className="text-[var(--color-text-primary)]">{t("assignments.uncovered.warning", { count })}</p>
      <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)} /><span>{t("assignments.uncovered.confirm")}</span></label>
      <Textarea label={t("assignments.uncovered.reason")} value={reason} maxLength={300} onChange={(e) => onReason(e.target.value)} hint={t("assignments.noHealthHint")} />
    </div>
  );
}

function MoveDialog({ board, resident, busy, onClose, onConfirm }: {
  board: ShiftBoard; resident: BoardResident; busy: boolean; onClose: () => void;
  onConfirm: (body: { moves: Array<{ careRecipientId: string; fromMembershipId: string; toMembershipId: string | null }>; effectiveAt?: string; confirmUncovered?: boolean; uncoveredReason?: string }) => Promise<boolean>;
}) {
  const { t } = useTranslation("residential");
  const [from, setFrom] = useState(resident.coveredBy[0] ?? "");
  const [to, setTo] = useState("");
  const [when, setWhen] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const nameOf = (id: string) => board.staff.find((s) => s.membershipId === id)?.name ?? t("assignments.unnamed");
  const moves = [{ careRecipientId: resident.id, fromMembershipId: from, toMembershipId: to || null }];
  const uncovered = uncoveredAfterMoves(board.residents, moves);
  const ready = from && to !== from && (uncovered.length === 0 || (confirmed && reason.trim().length >= 3));
  return (
    <Modal open onClose={onClose} title={t("assignments.move.title", { name: resident.name })} sheetOnMobile
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("assignments.cancel")}</Button>
        <Button disabled={busy || !ready} onClick={() => void onConfirm({ moves, effectiveAt: puertoRicoLocalToIso(when),
          ...(uncovered.length ? { confirmUncovered: true, uncoveredReason: reason.trim() } : {}) })}>{t("assignments.move.confirm")}</Button></div>}>
      <div className="flex flex-col gap-3">
        <p className="text-[var(--color-text-secondary)]">{t("assignments.move.body")}</p>
        <Select label={t("assignments.move.from")} value={from} onChange={(e) => setFrom(e.target.value)}>
          {resident.coveredBy.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
        </Select>
        <Select label={t("assignments.move.to")} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">{t("assignments.move.nobody")}</option>
          {board.staff.filter((s) => s.accepted && s.membershipId !== from).map((s) => <option key={s.membershipId} value={s.membershipId}>{s.name ?? t("assignments.unnamed")}</option>)}
        </Select>
        <WhenInput value={when} onChange={setWhen} />
        <UncoveredConfirm count={uncovered.length} confirmed={confirmed} reason={reason} onConfirmed={setConfirmed} onReason={setReason} />
      </div>
    </Modal>
  );
}

function SubstitutionDialog({ organizationId, locationId, board, original, busy, onClose, onConfirm }: {
  organizationId: string; locationId: string; board: ShiftBoard; original: BoardStaff; busy: boolean; onClose: () => void;
  onConfirm: (body: Parameters<typeof assignmentsApi.substitute>[2]) => Promise<boolean>;
}) {
  const { t } = useTranslation("residential");
  const toast = useToast();
  const [candidates, setCandidates] = useState<ScheduleStaff[] | null>(null);
  const [substitute, setSubstitute] = useState("");
  const [when, setWhen] = useState("");
  const [preview, setPreview] = useState<{ key: string; data: SubstitutionPreview } | null>(null);
  const [checking, setChecking] = useState(false);
  const [reasonCode, setReasonCode] = useState<SubstitutionReason | "">("");
  const [note, setNote] = useState("");
  const [availabilityOk, setAvailabilityOk] = useState(false);
  const [transfers, setTransfers] = useState<Record<string, string | null>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  // Candidatas: el personal autorizado del establecimiento (lista del calendario); la previa decide si puede.
  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) return;
    const week = mondayOf(puertoRicoDate(new Date(board.shift.scheduledStart)));
    scheduleApi.week(organizationId, locationId, week, token)
      .then(({ schedule }) => { if (active) setCandidates(schedule.staff.filter((s) => s.membershipId !== original.membershipId)); })
      .catch(() => { if (active) setCandidates([]); });
    return () => { active = false; };
  }, [organizationId, locationId, board.shift.scheduledStart, original.membershipId]);
  const previewKey = `${substitute}|${when}`;
  const current = preview && preview.key === previewKey ? preview.data : null;
  const check = async () => {
    const token = getToken();
    if (!token || !substitute) return;
    setChecking(true);
    try {
      const { preview: p } = await assignmentsApi.preview(organizationId, board.shift.id, { originalMembershipId: original.membershipId, substituteMembershipId: substitute, effectiveAt: puertoRicoLocalToIso(when) }, token);
      setPreview({ key: previewKey, data: p }); setTransfers(defaultTransfers(p.originalResidents, substitute)); setAvailabilityOk(false); setConfirmed(false);
    } catch (e) { toast.show(assignmentErrorMessage(e), "danger"); }
    finally { setChecking(false); }
  };
  const nameOfResident = (id: string) => board.residents.find((r) => r.id === id)?.name ?? "—";
  const destinations = [
    { id: substitute, name: candidates?.find((c) => c.membershipId === substitute)?.name ?? t("assignments.unnamed") },
    ...board.staff.filter((s) => s.accepted && s.membershipId !== original.membershipId && s.membershipId !== substitute).map((s) => ({ id: s.membershipId, name: s.name ?? t("assignments.unnamed") })),
  ];
  const uncovered = current ? uncoveredAfterSubstitution(board.residents, original.membershipId, current.originalResidents, transfers) : [];
  const ready = current && current.blocks.length === 0 && reasonCode && (!current.availabilityWarning || availabilityOk)
    && (uncovered.length === 0 || (confirmed && reason.trim().length >= 3));
  return (
    <Modal open onClose={onClose} title={t("assignments.substitution.title", { name: original.name ?? t("assignments.unnamed") })} fullScreenOnMobile wide
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("assignments.cancel")}</Button>
        <Button disabled={busy || !ready} onClick={() => current && reasonCode && void onConfirm({
          originalMembershipId: original.membershipId, substituteMembershipId: substitute, effectiveAt: puertoRicoLocalToIso(when), reasonCode,
          ...(note.trim() ? { reasonNote: note.trim() } : {}), ...(current.availabilityWarning ? { confirmAvailability: true } : {}),
          transfers: transfersBody(transfers), ...(uncovered.length ? { confirmUncovered: true, uncoveredReason: reason.trim() } : {}),
        })}>{t("assignments.substitution.confirm")}</Button></div>}>
      <div className="flex flex-col gap-3" data-testid="substitution-dialog">
        <p className="text-[var(--color-text-secondary)]">{t("assignments.substitution.body")}</p>
        {candidates === null ? <Skeleton className="h-10" /> : (
          <Select label={t("assignments.substitution.substitute")} value={substitute} onChange={(e) => setSubstitute(e.target.value)}>
            <option value="">{t("assignments.substitution.choose")}</option>
            {candidates.map((c) => <option key={c.membershipId} value={c.membershipId}>{c.name ?? t("assignments.unnamed")}</option>)}
          </Select>
        )}
        <WhenInput value={when} onChange={setWhen} />
        <div><Button variant="secondary" size="sm" disabled={!substitute || checking} onClick={() => void check()}>{t("assignments.substitution.check")}</Button></div>
        {current && (
          <>
            {current.blocks.length > 0 ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-700)]/40 bg-[var(--color-danger-100)] p-3" data-testid="substitution-blocks">
                <p className="font-semibold text-[var(--color-text-primary)]">{t("assignments.substitution.blocked")}</p>
                <ul className="list-disc pl-5">{current.blocks.map((b) => <li key={b}>{t(`assignments.blocks.${b}`)}</li>)}</ul>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("assignments.substitution.noOverride")}</p>
              </div>
            ) : (
              <>
                <p className="text-[var(--color-text-primary)]">{current.fullReplacement ? t("assignments.substitution.full") : t("assignments.substitution.partial")}</p>
                {current.availabilityWarning && (
                  <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)] p-3">
                    <input type="checkbox" checked={availabilityOk} onChange={(e) => setAvailabilityOk(e.target.checked)} /><span>{t("assignments.substitution.availability")}</span>
                  </label>
                )}
                <Select label={t("assignments.substitution.reason")} value={reasonCode} onChange={(e) => setReasonCode(e.target.value as SubstitutionReason)}>
                  <option value="">{t("assignments.substitution.choose")}</option>
                  {SUBSTITUTION_REASONS.map((r) => <option key={r} value={r}>{t(`assignments.reasons.${r}`)}</option>)}
                </Select>
                <Textarea label={t("assignments.substitution.note")} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} hint={t("assignments.noHealthHint")} />
                {current.originalResidents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-semibold text-[var(--color-text-primary)]">{t("assignments.substitution.transfers")}</p>
                    {current.originalResidents.map((id) => (
                      <Select key={id} label={nameOfResident(id)} value={transfers[id] ?? ""} onChange={(e) => setTransfers({ ...transfers, [id]: e.target.value || null })}>
                        {destinations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        <option value="">{t("assignments.move.nobody")}</option>
                      </Select>
                    ))}
                  </div>
                )}
                <UncoveredConfirm count={uncovered.length} confirmed={confirmed} reason={reason} onConfirmed={setConfirmed} onReason={setReason} />
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("assignments.substitution.punchesKept")}</p>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function HistoryDialog({ organizationId, shiftId, onClose }: { organizationId: string; shiftId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const [state, setState] = useState<{ periods: HistoryPeriod[]; substitutions: HistorySubstitution[] } | "error" | null>(null);
  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) return;
    assignmentsApi.history(organizationId, shiftId, token)
      .then(({ history }) => { if (active) setState(history); })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [organizationId, shiftId]);
  return (
    <Modal open onClose={onClose} title={t("assignments.history.title")} fullScreenOnMobile wide>
      {state === null ? <Skeleton className="h-32" /> : state === "error" ? <ErrorState kind="server" /> : (
        <div className="flex flex-col gap-4" data-testid="assignment-history">
          <section>
            <h3 className="mb-2 font-semibold text-[var(--color-text-primary)]">{t("assignments.history.substitutions")}</h3>
            {state.substitutions.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("assignments.history.none")}</p> : (
              <ul className="flex flex-col gap-2">{state.substitutions.map((s) => (
                <li key={s.id} className="text-[var(--color-text-primary)]">
                  {t("assignments.history.substitutionLine", { original: s.original ?? "—", substitute: s.substitute ?? "—", at: fmt(s.effectiveAt, lang), reason: t(`assignments.reasons.${s.reasonCode}`) })}
                  {s.reasonNote ? <span className="text-[var(--color-text-secondary)]">{` · ${s.reasonNote}`}</span> : null}
                  <span className="block text-[var(--text-small)] text-[var(--color-text-secondary)]">{`${s.fullReplacement ? t("assignments.history.full") : t("assignments.history.partial")} · ${s.createdBy ?? "—"} · ${fmt(s.createdAt, lang)}`}</span>
                </li>
              ))}</ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 font-semibold text-[var(--color-text-primary)]">{t("assignments.history.periods")}</h3>
            {state.periods.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("assignments.history.none")}</p> : (
              <ul className="flex flex-col gap-2">{state.periods.map((p) => (
                <li key={p.id} className="text-[var(--color-text-primary)]">
                  {`${p.resident} → ${p.worker ?? "—"} · ${fmt(p.from, lang)} – ${p.until ? fmt(p.until, lang) : t("assignments.history.open_")}`}
                  <span className="block text-[var(--text-small)] text-[var(--color-text-secondary)]">
                    {`${t(`assignments.origins.${p.origin}`)}${p.closeReason ? ` · ${t(`assignments.closeReasons.${p.closeReason}`)}` : ""} · ${p.createdBy ?? "—"}`}
                  </span>
                </li>
              ))}</ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function AlertsList({ alerts, language, busy, onResolve }: { alerts: CoverageAlert[]; language: string | undefined; busy: boolean; onResolve: (a: CoverageAlert) => void }) {
  const { t } = useTranslation("residential");
  if (alerts.length === 0) return <EmptyState title={t("assignments.alerts.emptyTitle")} description={t("assignments.alerts.emptyDetail")} />;
  return (
    <ul className="flex flex-col gap-3">
      {alerts.map((a) => (
        <li key={a.id}><Card className="flex flex-wrap items-center justify-between gap-2 p-[var(--spacing-md)]">
          <div>
            <p className="text-[var(--color-text-primary)]">{t("assignments.alerts.line", { resident: a.resident, location: a.location, at: fmt(a.uncoveredFrom, language) })}</p>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{a.reason}</p>
          </div>
          {a.resolvedAt ? <Badge tone="neutral">{t("assignments.alerts.resolved")}</Badge>
            : <Button size="sm" variant="secondary" disabled={busy} onClick={() => onResolve(a)}>{t("assignments.alerts.resolve")}</Button>}
        </Card></li>
      ))}
    </ul>
  );
}
