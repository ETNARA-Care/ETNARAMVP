import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, Tabs, Textarea, useToast } from "@/components/ui";
import {
  attendanceApi, attendanceErrorMessage, type AttendanceAlert, type CodesView, type Correction, type EffectiveStatus, type Policy, type PrintView,
  type Punch, type WeekRow,
} from "@/api/residentialAttendance";
import { csvLines } from "@/features/export/csv";
import { attendanceCsvRows, minutesToHours, punchLink } from "@/features/residential/attendance";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization, RESIDENTIAL_PANEL_PATH } from "@/features/residential/modality";
import { mondayOf, puertoRicoDate, addDays } from "@/features/residential/schedule";

/**
 * 173–175 (hogares F4): asistencia del hogar. Solo hogares, solo con HOGAR_PONCHES y solo administración.
 * El portal no valida nada: muestra lo que decide el backend (cuatro dimensiones de cada ponche) y vuelve a leer tras
 * cada cambio. Ninguna irregularidad elimina horas ni genera deducciones.
 */
type Tab = "codes" | "review" | "corrections" | "alerts" | "week" | "policy";
type Data = { codes: CodesView | null; punches: Punch[]; pendingTotal: number; corrections: Correction[]; alerts: AttendanceAlert[]; week: WeekRow[]; policy: Policy | null };
const fmt = (iso: string | null, lang: string | undefined) => (iso ? new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico" }) : "—");
const statusTone = (s: EffectiveStatus) => (s === "validated" ? "success" : s === "justified" ? "accent" : s === "not_recognized" ? "neutral" : "warning");

export function ResidentialAttendancePage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_PONCHES");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("codes");
  const [estState, setEstState] = useState<OrganizationScoped<Array<{ id: string; name: string }>> | null>(null);
  const [selected, setSelected] = useState<{ organizationId: string; locationId: string } | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(puertoRicoDate()));
  const [state, setState] = useState<OrganizationScoped<Data> | null>(null);
  const [dialogState, setDialogState] = useState<{ organizationId: string; dialog: ReactNode } | null>(null);
  const [printState, setPrintState] = useState<{ organizationId: string; print: PrintView } | null>(null);
  const [busy, setBusy] = useState(false);
  const latestList = useRef(createLatestRequest());
  const latest = useRef(createLatestRequest());

  const loadEstablishments = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential || !enabled) return;
    const request = latestList.current.begin();
    try {
      const { establishments } = await attendanceApi.establishments(organizationId, token);
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
  const key = locationId ? `${locationId}|${weekStart}` : undefined;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !locationId || !residential || !enabled) return;
    const request = latest.current.begin();
    const k = `${locationId}|${weekStart}`;
    try {
      const [codes, punches, corrections, alerts, week, policy] = await Promise.all([
        attendanceApi.codes(organizationId, locationId, token), attendanceApi.punches(organizationId, { locationId }, token),
        attendanceApi.corrections(organizationId, token), attendanceApi.alerts(organizationId, token),
        attendanceApi.week(organizationId, locationId, weekStart, token), attendanceApi.policy(organizationId, locationId, token),
      ]);
      if (request.isCurrent()) setState({ organizationId, key: k, error: false, data: {
        codes: codes.codes, punches: punches.result.punches, pendingTotal: punches.result.pendingTotal, corrections: corrections.corrections,
        alerts: alerts.alerts, week: week.week.rows, policy: policy.policy } });
    } catch {
      if (request.isCurrent()) setState({ organizationId, key: k, data: null, error: true });
    }
  }, [organizationId, locationId, weekStart, residential, enabled]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);
  const current = scopedTo(state, organizationId, key);
  const data = current?.data ?? null;
  const error = current?.error === true;
  const dialog = dialogState && dialogState.organizationId === organizationId ? dialogState.dialog : null;
  const printView = printState && printState.organizationId === organizationId ? printState.print : null;
  const open = (d: ReactNode) => organizationId && setDialogState({ organizationId, dialog: d });
  const close = () => setDialogState(null);

  /** Ejecuta un cambio, avisa y vuelve a leer (el backend es la fuente de verdad). */
  const run = async (fn: (o: string, l: string, token: string) => Promise<unknown>, ok: string) => {
    const token = getToken();
    if (!organizationId || !locationId || !token) return false;
    setBusy(true);
    try { await fn(organizationId, locationId, token); toast.show(ok, "success"); close(); await load(); return true; }
    catch (e) { toast.show(attendanceErrorMessage(e), "danger"); await load(); return false; }
    finally { setBusy(false); }
  };
  const doPrint = async (week: string) => {
    const token = getToken();
    if (!organizationId || !locationId || !token) return;
    setBusy(true);
    try { const { print } = await attendanceApi.print(organizationId, locationId, week, token); setPrintState({ organizationId, print }); await load(); }
    catch (e) { toast.show(attendanceErrorMessage(e), "danger"); }
    finally { setBusy(false); }
  };

  if (!residential) return <Navigate to="/agency" replace />;
  if (!enabled) return <Navigate to={RESIDENTIAL_PANEL_PATH} replace />;
  if (printView) return <PrintSheet print={printView} onClose={() => setPrintState(null)} />;

  const pendingCorrections = data?.corrections.filter((c) => c.status === "pending") ?? [];
  const openAlerts = data?.alerts.filter((a) => !a.acknowledgedAt) ?? [];
  return (
    <div className="flex flex-col gap-6" data-testid="residential-attendance">
      <PageHeader title={t("attendance.title")} description={t("attendance.description")} />
      {listError ? <ErrorState kind="server" onRetry={() => { setEstState(null); void loadEstablishments(); }} /> : establishments === null ? <Skeleton className="h-32" /> : establishments.length === 0 ? (
        <EmptyState title={t("attendance.noEstablishmentsTitle")} description={t("attendance.noEstablishmentsDetail")} />
      ) : (
        <>
          {establishments.length > 1 && (
            <div className="max-w-[24rem]">
              <Select label={t("attendance.establishment")} value={locationId ?? ""} onChange={(e) => organizationId && setSelected({ organizationId, locationId: e.target.value })}>
                {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </div>
          )}
          {/* Seis pestañas: en pantallas estrechas la barra se desplaza en horizontal. */}
          <div className="overflow-x-auto"><Tabs value={tab} onChange={(id) => setTab(id as Tab)} items={[
            { id: "codes", label: t("attendance.tabs.codes") },
            { id: "review", label: t("attendance.tabs.review", { count: data?.pendingTotal ?? 0 }) },
            { id: "corrections", label: t("attendance.tabs.corrections", { count: pendingCorrections.length }) },
            { id: "alerts", label: t("attendance.tabs.alerts", { count: openAlerts.length }) },
            { id: "week", label: t("attendance.tabs.week") },
            { id: "policy", label: t("attendance.tabs.policy") },
          ]} /></div>
          {error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : !data ? <Skeleton className="h-64" /> : (
            <>
              {tab === "codes" && data.codes && <CodesTab codes={data.codes} busy={busy} language={lang} onPrint={(w) => void doPrint(w)}
                onRevoke={(w) => open(<ReasonDialog title={t("attendance.codes.revokeTitle")} body={t("attendance.codes.revokeBody")} confirm={t("attendance.codes.revoke")} danger busy={busy} onClose={close}
                  onConfirm={(reason) => run((o, l, token) => attendanceApi.revoke(o, l, w, reason, token), t("attendance.toasts.revoked"))} />)} />}
              {tab === "review" && <ReviewTab punches={data.punches} busy={busy} language={lang} onHistory={(p) => open(<HistoryDialog organizationId={organizationId!} punch={p} onClose={close} />)}
                onReview={(ids, decision) => open(<ReasonDialog title={t(`attendance.review.decisionTitle.${decision}`, { count: ids.length })} body={t("attendance.review.reasonBody")} confirm={t("attendance.review.confirm")} busy={busy} onClose={close}
                  onConfirm={(reason) => run((o, _l, token) => attendanceApi.review(o, ids, decision, reason, token), t("attendance.toasts.reviewed", { count: ids.length }))} />)} />}
              {tab === "corrections" && <CorrectionsTab corrections={data.corrections} busy={busy} language={lang}
                onDecide={(c, approve) => open(<ReasonDialog title={approve ? t("attendance.corrections.approveTitle") : t("attendance.corrections.rejectTitle")} body={approve ? t("attendance.corrections.approveBody") : t("attendance.corrections.rejectBody")}
                  confirm={approve ? t("attendance.corrections.approve") : t("attendance.corrections.reject")} danger={!approve} busy={busy} onClose={close}
                  onConfirm={(reason) => run((o, _l, token) => attendanceApi.decide(o, c.id, approve, reason, token), t("attendance.toasts.decided"))} />)} />}
              {tab === "alerts" && <AlertsTab alerts={data.alerts} busy={busy} language={lang} onAck={(a) => void run((o, _l, token) => attendanceApi.acknowledge(o, a.id, token), t("attendance.toasts.acknowledged"))} />}
              {tab === "week" && <WeekTab rows={data.week} weekStart={weekStart} language={lang} onWeek={setWeekStart} />}
              {tab === "policy" && data.policy && <PolicyTab policy={data.policy} busy={busy}
                onSave={(body) => run((o, l, token) => attendanceApi.updatePolicy(o, l, body, token), t("attendance.toasts.policySaved"))} />}
            </>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

function CodeCard({ title, code, language, children }: { title: string; code: CodesView["current"]; language: string | undefined; children?: ReactNode }) {
  const { t } = useTranslation("residential");
  return (
    <Card className="flex flex-col gap-2">
      <p className="font-medium text-[var(--color-text-primary)]">{title}</p>
      {!code ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.codes.none")}</p> : (
        <>
          <p className="text-[var(--text-small)]">{t("attendance.codes.validity", { from: fmt(code.validFrom, language), until: fmt(code.validUntil, language) })}</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.codes.versionLine", { version: code.version, hours: code.transitionHours })}</p>
          {!code.available && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.codes.availableFrom", { at: fmt(code.availableFrom, language) })}</p>}
          {children}
        </>
      )}
    </Card>
  );
}
function CodesTab({ codes, busy, language, onPrint, onRevoke }: { codes: CodesView; busy: boolean; language: string | undefined; onPrint: (w: string) => void; onRevoke: (w: string) => void }) {
  const { t } = useTranslation("residential");
  return (
    <div className="flex flex-col gap-4" data-testid="attendance-codes">
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.codes.explain")}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <CodeCard title={t("attendance.codes.current")} code={codes.current} language={language}>
          {codes.current && <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => onPrint(codes.current!.weekStart)}>{t("attendance.codes.print")}</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => onRevoke(codes.current!.weekStart)}>{t("attendance.codes.revoke")}</Button>
          </div>}
        </CodeCard>
        <CodeCard title={t("attendance.codes.next")} code={codes.next} language={language}>
          {codes.next && <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={busy || !codes.next.available} onClick={() => onPrint(codes.next!.weekStart)}>{t("attendance.codes.print")}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRevoke(codes.next!.weekStart)}>{t("attendance.codes.revoke")}</Button>
          </div>}
        </CodeCard>
      </div>
      <Card>
        <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.codes.transitionTitle")}</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{codes.transition ? t("attendance.codes.transitionActive", { until: fmt(codes.transition.transitionUntil, language) }) : t("attendance.codes.transitionNone")}</p>
      </Card>
      <Card>
        <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.codes.history")}</p>
        <ul className="mt-1 flex flex-col gap-1 text-[var(--text-small)]" data-testid="attendance-code-history">
          {codes.events.length === 0 ? <li className="text-[var(--color-text-secondary)]">{t("attendance.codes.noHistory")}</li> : codes.events.map((e, i) => (
            <li key={`${e.at}-${i}`}>{`${fmt(e.at, language)} · ${t(`attendance.codes.event.${e.type}`)} · ${t("attendance.codes.weekVersion", { week: e.weekStart, version: e.version })}${e.actorEmail ? ` · ${e.actorEmail}` : ` · ${t("attendance.codes.system")}`}${e.reason ? ` · ${e.reason}` : ""}`}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Hoja para imprimir: el QR y el código se dibujan aquí con lo que acaba de derivar el servidor; no se guardan. */
function PrintSheet({ print, onClose }: { print: PrintView; onClose: () => void }) {
  const { t, i18n } = useTranslation("residential");
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(punchLink(window.location.origin, print.qr), { errorCorrectionLevel: "M", margin: 2, width: 512 })
      .then((url) => { if (active) setImg(url); }).catch(() => { if (active) setImg(null); });
    return () => { active = false; };
  }, [print.qr]);
  const lang = i18n.resolvedLanguage;
  return (
    <div className="flex flex-col items-center gap-4 bg-white p-6 text-center text-black" data-testid="attendance-print">
      <div className="flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>{t("attendance.printSheet.print")}</Button>
        <Button variant="ghost" onClick={onClose}>{t("attendance.printSheet.close")}</Button>
      </div>
      <h1 className="text-2xl font-semibold">{t("attendance.printSheet.title", { name: print.establishment.name })}</h1>
      <p>{t("attendance.codes.validity", { from: fmt(print.code.validFrom, lang), until: fmt(print.code.validUntil, lang) })}</p>
      {img ? <img src={img} alt={t("attendance.printSheet.qrAlt")} className="h-72 w-72" /> : <Skeleton className="h-72 w-72" />}
      <p className="text-[var(--text-small)]">{t("attendance.printSheet.pinLabel")}</p>
      <p className="font-mono text-4xl tracking-[0.3em]" data-testid="attendance-pin">{print.pin}</p>
      <p className="max-w-[28rem] text-[var(--text-small)]">{t("attendance.printSheet.instructions")}</p>
      <p className="max-w-[28rem] text-[var(--text-small)]">{t("attendance.printSheet.version", { version: print.code.version })}</p>
    </div>
  );
}

function PunchSummary({ p, language }: { p: Punch; language: string | undefined }) {
  const { t } = useTranslation("residential");
  return (
    <div className="flex min-w-0 flex-col gap-1 text-[var(--text-small)]">
      <p className="font-medium text-[var(--color-text-primary)]">{`${p.workerName ?? t("attendance.unnamed")} · ${t(`attendance.punchType.${p.type}`)} · ${fmt(p.effectiveAt, language)}`}</p>
      <div className="flex flex-wrap gap-1">
        <Badge tone={statusTone(p.validation.effective)}>{t(`attendance.status.${p.validation.effective}`)}</Badge>
        <Badge tone={p.location.status === "inside" ? "success" : p.location.status === "outside" ? "warning" : "neutral"}>{t(`attendance.location.${p.location.status}`)}{p.location.distanceM !== null ? ` · ${p.location.distanceM} m` : ""}</Badge>
        <Badge tone="neutral">{t(`attendance.origin.${p.origin}`)}</Badge>
        <Badge tone={p.code.status === "current" || p.code.status === "transition" ? "success" : "neutral"}>{t(`attendance.code.${p.code.status}`)}</Badge>
      </div>
      {p.origin === "offline" && <p className="text-[var(--color-text-secondary)]">{t("attendance.review.offlineTimes", { declared: fmt(p.declaredAt, language), received: fmt(p.serverReceivedAt, language) })}</p>}
      {p.flags.length > 0 && <p className="text-[var(--color-text-secondary)]">{p.flags.map((f) => t(`attendance.flags.${f}`)).join(" · ")}</p>}
      {p.manualReason && <p className="text-[var(--color-text-secondary)]">{p.manualReason}</p>}
    </div>
  );
}
function ReviewTab({ punches, busy, language, onReview, onHistory }: { punches: Punch[]; busy: boolean; language: string | undefined;
  onReview: (ids: string[], d: Exclude<EffectiveStatus, "pending_review">) => void; onHistory: (p: Punch) => void }) {
  const { t } = useTranslation("residential");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [picked, setPicked] = useState<string[]>([]);
  const list = punches.filter((p) => filter === "all" || p.validation.effective === "pending_review");
  const ids = picked.filter((id) => list.some((p) => p.id === id));
  return (
    <div className="flex flex-col gap-3" data-testid="attendance-review">
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.review.explain")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48"><Select label={t("attendance.review.filter")} value={filter} onChange={(e) => setFilter(e.target.value as "pending" | "all")}>
          <option value="pending">{t("attendance.review.onlyPending")}</option><option value="all">{t("attendance.review.all")}</option>
        </Select></div>
        <Button size="sm" disabled={busy || ids.length === 0} onClick={() => onReview(ids, "validated")}>{t("attendance.review.validate", { count: ids.length })}</Button>
        <Button size="sm" variant="secondary" disabled={busy || ids.length === 0} onClick={() => onReview(ids, "justified")}>{t("attendance.review.justify", { count: ids.length })}</Button>
        <Button size="sm" variant="ghost" disabled={busy || ids.length === 0} onClick={() => onReview(ids, "not_recognized")}>{t("attendance.review.notRecognize", { count: ids.length })}</Button>
      </div>
      {list.length === 0 ? <EmptyState title={t("attendance.review.emptyTitle")} description={t("attendance.review.emptyDetail")} /> : list.map((p) => (
        <Card key={p.id} className="flex items-start gap-3" data-testid="attendance-punch">
          <input type="checkbox" className="mt-1 h-5 w-5" aria-label={t("attendance.review.select")} checked={picked.includes(p.id)}
            onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id)))} />
          <PunchSummary p={p} language={language} />
          <Button size="sm" variant="ghost" onClick={() => onHistory(p)}>{t("attendance.review.history")}</Button>
        </Card>
      ))}
    </div>
  );
}
function CorrectionsTab({ corrections, busy, language, onDecide }: { corrections: Correction[]; busy: boolean; language: string | undefined; onDecide: (c: Correction, approve: boolean) => void }) {
  const { t } = useTranslation("residential");
  return (
    <div className="flex flex-col gap-3" data-testid="attendance-corrections">
      {corrections.length === 0 ? <EmptyState title={t("attendance.corrections.emptyTitle")} description={t("attendance.corrections.emptyDetail")} /> : corrections.map((c) => (
        <Card key={c.id} className="flex flex-col gap-2 text-[var(--text-small)]">
          <p className="font-medium text-[var(--color-text-primary)]">{`${c.workerName ?? t("attendance.unnamed")} · ${t(`attendance.punchType.${c.type}`)} · ${fmt(c.requestedAt, language)}`}</p>
          <p className="text-[var(--color-text-secondary)]">{c.punchId ? t("attendance.corrections.fixExisting") : t("attendance.corrections.missing")} · {c.reason}</p>
          {c.status === "pending" ? <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => onDecide(c, true)}>{t("attendance.corrections.approve")}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(c, false)}>{t("attendance.corrections.reject")}</Button>
          </div> : <Badge tone={c.status === "approved" ? "success" : "neutral"}>{t(`attendance.corrections.status.${c.status}`)}</Badge>}
        </Card>
      ))}
    </div>
  );
}
function AlertsTab({ alerts, busy, language, onAck }: { alerts: AttendanceAlert[]; busy: boolean; language: string | undefined; onAck: (a: AttendanceAlert) => void }) {
  const { t } = useTranslation("residential");
  return (
    <div className="flex flex-col gap-3" data-testid="attendance-alerts">
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.alerts.explain")}</p>
      {alerts.length === 0 ? <EmptyState title={t("attendance.alerts.emptyTitle")} description={t("attendance.alerts.emptyDetail")} /> : alerts.map((a) => (
        <Card key={a.id} className="flex items-center justify-between gap-2 text-[var(--text-small)]">
          <div><p className="font-medium text-[var(--color-text-primary)]">{t(`attendance.alerts.kind.${a.kind}`)}</p>
            <p className="text-[var(--color-text-secondary)]">{`${a.workerName ?? t("attendance.unnamed")} · ${a.locationName} · ${fmt(a.createdAt, language)}`}</p></div>
          {a.acknowledgedAt ? <Badge tone="neutral">{t("attendance.alerts.seen")}</Badge> : <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAck(a)}>{t("attendance.alerts.acknowledge")}</Button>}
        </Card>
      ))}
    </div>
  );
}
function WeekTab({ rows, weekStart, language, onWeek }: { rows: WeekRow[]; weekStart: string; language: string | undefined; onWeek: (w: string) => void }) {
  const { t } = useTranslation("residential");
  const exportCsv = () => {
    const csv = attendanceCsvRows(t("attendance.week.csvNotice"), [t("attendance.week.csv.shift"), t("attendance.week.csv.person"), t("attendance.week.csv.firstIn"), t("attendance.week.csv.lastOut"),
      t("attendance.week.csv.late"), t("attendance.week.csv.early"), t("attendance.week.csv.absent"), t("attendance.week.csv.validated"), t("attendance.week.csv.pending")], rows, t("attendance.yes"), t("attendance.no"));
    const blob = new Blob([csvLines(csv)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `etnara-asistencia-${weekStart}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="flex flex-col gap-3" data-testid="attendance-week">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onWeek(addDays(weekStart, -7))}>{t("attendance.week.prev")}</Button>
        <span className="font-medium">{weekStart}</span>
        <Button variant="ghost" size="sm" onClick={() => onWeek(addDays(weekStart, 7))}>{t("attendance.week.next")}</Button>
        <Button variant="ghost" size="sm" disabled={rows.length === 0} onClick={exportCsv}>{t("attendance.week.export")}</Button>
      </div>
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.week.notice")}</p>
      {rows.length === 0 ? <EmptyState title={t("attendance.week.emptyTitle")} description={t("attendance.week.emptyDetail")} /> : rows.map((r) => (
        <Card key={`${r.shiftId}-${r.membershipId}`} className="flex flex-col gap-1 text-[var(--text-small)]">
          <p className="font-medium text-[var(--color-text-primary)]">{`${r.workerName ?? t("attendance.unnamed")} · ${fmt(r.scheduledStart, language)}`}</p>
          <div className="flex flex-wrap gap-1">
            {r.absent && <Badge tone="warning">{t("attendance.week.absent")}</Badge>}
            {r.lateMinutes > 0 && <Badge tone="warning">{t("attendance.week.late", { count: r.lateMinutes })}</Badge>}
            {r.earlyLeaveMinutes > 0 && <Badge tone="warning">{t("attendance.week.early", { count: r.earlyLeaveMinutes })}</Badge>}
            {r.openSession && <Badge tone="accent">{t("attendance.week.open")}</Badge>}
          </div>
          <p className="text-[var(--color-text-secondary)]">{t("attendance.week.hours", { validated: minutesToHours(r.validatedMinutes), pending: minutesToHours(r.pendingMinutes) })}</p>
        </Card>
      ))}
    </div>
  );
}
function PolicyTab({ policy, busy, onSave }: { policy: Policy; busy: boolean; onSave: (b: Omit<Policy, "version"> & { reason: string }) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [v, setV] = useState({ transitionHours: String(policy.transitionHours), lateToleranceMinutes: String(policy.lateToleranceMinutes), earlyLeaveToleranceMinutes: String(policy.earlyLeaveToleranceMinutes), absenceAfterMinutes: String(policy.absenceAfterMinutes) });
  const [reason, setReason] = useState("");
  const n = (s: string) => Number(s);
  const valid = Number.isInteger(n(v.transitionHours)) && n(v.transitionHours) >= 0 && n(v.transitionHours) <= 12
    && [v.lateToleranceMinutes, v.earlyLeaveToleranceMinutes].every((x) => Number.isInteger(n(x)) && n(x) >= 0 && n(x) <= 120)
    && Number.isInteger(n(v.absenceAfterMinutes)) && n(v.absenceAfterMinutes) >= 15 && n(v.absenceAfterMinutes) <= 720 && reason.trim().length >= 3;
  return (
    <Card className="flex max-w-[32rem] flex-col gap-3" data-testid="attendance-policy">
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.policy.explain", { version: policy.version })}</p>
      <Input label={t("attendance.policy.transition")} inputMode="numeric" value={v.transitionHours} onChange={(e) => setV({ ...v, transitionHours: e.target.value })} hint={t("attendance.policy.transitionHint")} />
      <Input label={t("attendance.policy.late")} inputMode="numeric" value={v.lateToleranceMinutes} onChange={(e) => setV({ ...v, lateToleranceMinutes: e.target.value })} />
      <Input label={t("attendance.policy.early")} inputMode="numeric" value={v.earlyLeaveToleranceMinutes} onChange={(e) => setV({ ...v, earlyLeaveToleranceMinutes: e.target.value })} />
      <Input label={t("attendance.policy.absence")} inputMode="numeric" value={v.absenceAfterMinutes} onChange={(e) => setV({ ...v, absenceAfterMinutes: e.target.value })} />
      <Textarea label={t("attendance.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      <div><Button disabled={busy || !valid} onClick={() => void onSave({ transitionHours: n(v.transitionHours), lateToleranceMinutes: n(v.lateToleranceMinutes),
        earlyLeaveToleranceMinutes: n(v.earlyLeaveToleranceMinutes), absenceAfterMinutes: n(v.absenceAfterMinutes), reason: reason.trim() })}>{t("attendance.policy.save")}</Button></div>
    </Card>
  );
}

function ReasonDialog({ title, body, confirm, danger, busy, onClose, onConfirm }: { title: string; body: string; confirm: string; danger?: boolean; busy: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [reason, setReason] = useState("");
  return (
    <Modal open onClose={onClose} title={title} sheetOnMobile
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("attendance.cancel")}</Button>
        <Button variant={danger ? "danger" : "primary"} disabled={busy || reason.trim().length < 3} onClick={() => void onConfirm(reason.trim())}>{confirm}</Button></div>}>
      <div className="flex flex-col gap-3">
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">{body}</p>
        <Textarea label={t("attendance.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} hint={t("attendance.reasonHint")} />
      </div>
    </Modal>
  );
}
function HistoryDialog({ organizationId, punch, onClose }: { organizationId: string; punch: Punch; onClose: () => void }) {
  const { t, i18n } = useTranslation("residential");
  const [state, setState] = useState<OrganizationScoped<Array<{ decision: EffectiveStatus; reason: string; at: string; reviewerEmail: string | null }>> | null>(null);
  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) return;
    attendanceApi.punchHistory(organizationId, punch.id, token)
      .then(({ history }) => { if (active) setState({ organizationId, key: punch.id, data: history.reviews, error: false }); })
      .catch(() => { if (active) setState({ organizationId, key: punch.id, data: null, error: true }); });
    return () => { active = false; };
  }, [organizationId, punch.id]);
  const current = scopedTo(state, organizationId, punch.id);
  return (
    <Modal open onClose={onClose} title={t("attendance.review.historyTitle")} sheetOnMobile footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>{t("attendance.cancel")}</Button></div>}>
      <div className="flex flex-col gap-3">
        <PunchSummary p={punch} language={i18n.resolvedLanguage} />
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.review.original", { status: t(`attendance.status.${punch.validation.initial}`) })}</p>
        {current?.error ? <ErrorState kind="server" /> : !current?.data ? <Skeleton className="h-12" /> : current.data.length === 0 ? <p className="text-[var(--text-small)]">{t("attendance.review.noDecisions")}</p> : (
          <ul className="text-[var(--text-small)]">{current.data.map((r, i) => <li key={i}>{`${fmt(r.at, i18n.resolvedLanguage)} · ${t(`attendance.status.${r.decision}`)} · ${r.reviewerEmail ?? t("attendance.unnamed")} · ${r.reason}`}</li>)}</ul>
        )}
      </div>
    </Modal>
  );
}
