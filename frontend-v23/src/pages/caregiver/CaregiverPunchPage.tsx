import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { attendanceApi, attendanceErrorMessage, type MyAttendance, type Punch, type PunchInput, type PunchType } from "@/api/residentialAttendance";
import { availablePunchTypes, dropQueuedAfterError, enqueue, parseQueue, qrFromLink, QUEUE_KEY, type QueuedPunch } from "@/features/residential/attendance";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization } from "@/features/residential/modality";

/**
 * 173–175 (hogares F4): «Ponchar» del personal del hogar. Solo hogares y solo con HOGAR_PONCHES.
 * - El código llega por el QR impreso (abre esta pantalla con ?c=…) o se escribe el de 6 dígitos.
 * - La ubicación solo se lee al ponchar y solo con consentimiento vigente; el teléfono no la guarda.
 * - Sin conexión el ponche queda en el teléfono SIN ubicación y se envía después: el servidor lo deja pendiente de
 *   revisión. El servidor decide todo; esta pantalla solo muestra su respuesta.
 */
const readQueue = (): QueuedPunch[] => { try { return parseQueue(localStorage.getItem(QUEUE_KEY)); } catch { return []; } };
const writeQueue = (q: QueuedPunch[]) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* almacenamiento no disponible */ } };
const fmt = (iso: string, lang: string | undefined) => new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico", dateStyle: "medium", timeStyle: "short" });

/** Una sola lectura, con límite de tiempo; si falla, se poncha igual («ubicación no disponible»). */
function readLocationOnce(): Promise<PunchInput["location"]> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export function CaregiverPunchPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_PONCHES");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const toast = useToast();
  const routeLocation = useLocation();
  const qr = qrFromLink(routeLocation.search);
  const [state, setState] = useState<OrganizationScoped<MyAttendance> | null>(null);
  const [shiftChoice, setShiftChoice] = useState<{ organizationId: string; shiftId: string } | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ organizationId: string; punch: Punch } | null>(null);
  const [queue, setQueue] = useState<QueuedPunch[]>(() => readQueue());
  const latest = useRef(createLatestRequest());

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential || !enabled) return;
    const request = latest.current.begin();
    try {
      const { attendance } = await attendanceApi.me(organizationId, token);
      if (request.isCurrent()) setState({ organizationId, data: attendance, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential, enabled]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);
  const current = scopedTo(state, organizationId);
  const data = current?.data ?? null;
  const chosen = shiftChoice && shiftChoice.organizationId === organizationId ? shiftChoice.shiftId : null;
  const shift = data?.shifts.find((s) => s.shiftId === chosen) ?? data?.shifts[0] ?? null;
  const last = result && result.organizationId === organizationId ? result.punch : null;
  const myQueue = queue.filter((q) => q.organizationId === organizationId);

  /** Reenvía la cola (mismo client_event_id: el servidor no duplica). */
  const flush = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    let rest = readQueue();
    for (const item of rest.filter((q) => q.organizationId === organizationId)) {
      try {
        await attendanceApi.punch(organizationId, { clientEventId: item.clientEventId, shiftId: item.shiftId, type: item.type, method: item.method,
          ...(item.method === "qr" ? { qr: item.qr } : { pin: item.pin }), offline: true, declaredAt: item.declaredAt, deviceNow: new Date().toISOString() }, token);
        rest = rest.filter((q) => q.clientEventId !== item.clientEventId);
      } catch (e) {
        if ((e as { isNetworkError?: boolean }).isNetworkError) break;
        // Rechazo definitivo (4xx): se quita y no se reintenta en bucle. Un 5xx o un 429 no es un rechazo: se conserva y
        // se detiene el envío, para no mandar los siguientes (p. ej. la salida) antes que este (la entrada).
        if (!dropQueuedAfterError(e)) break;
        rest = rest.filter((q) => q.clientEventId !== item.clientEventId);
      }
    }
    writeQueue(rest); setQueue(rest); await load();
  }, [organizationId, load]);
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    if (navigator.onLine && readQueue().some((q) => q.organizationId === organizationId)) void flush();
    return () => window.removeEventListener("online", onOnline);
  }, [flush, organizationId]);

  const doPunch = async (type: PunchType) => {
    const token = getToken();
    if (!organizationId || !token || !shift) return;
    const method: "qr" | "pin" = qr ? "qr" : "pin";
    if (method === "pin" && !/^\d{6}$/.test(pin)) return;
    setBusy(true);
    const clientEventId = crypto.randomUUID();
    const declaredAt = new Date().toISOString();
    const queued: QueuedPunch = { clientEventId, organizationId, shiftId: shift.shiftId, type, method, ...(method === "qr" ? { qr: qr! } : { pin }), declaredAt };
    try {
      if (!navigator.onLine) throw { isNetworkError: true };
      const location = data?.consent.accepted ? await readLocationOnce() : undefined;
      const r = await attendanceApi.punch(organizationId, { clientEventId, shiftId: shift.shiftId, type, method, ...(method === "qr" ? { qr: qr! } : { pin }),
        deviceNow: new Date().toISOString(), ...(location ? { location } : {}) }, token);
      setResult({ organizationId, punch: r.punch }); setPin("");
      toast.show(r.punch.validation.effective === "validated" ? t("attendance.punch.okValidated") : t("attendance.punch.okPending"), r.punch.validation.effective === "validated" ? "success" : "warning");
      await load();
    } catch (e) {
      if ((e as { isNetworkError?: boolean }).isNetworkError) {
        const next = enqueue(readQueue(), queued); writeQueue(next); setQueue(next); setPin("");
        toast.show(t("attendance.punch.queued"), "warning");
      } else {
        toast.show(attendanceErrorMessage(e), "danger");
      }
    } finally { setBusy(false); }
  };
  const setConsent = async (accept: boolean) => {
    const token = getToken();
    if (!organizationId || !token || !data) return;
    setBusy(true);
    try { await attendanceApi.consent(organizationId, data.consent.currentVersion, accept, token); await load(); }
    catch (e) { toast.show(attendanceErrorMessage(e), "danger"); }
    finally { setBusy(false); }
  };

  if (!residential || !enabled) return <Navigate to="/caregiver/today" replace />;
  return (
    <div className="flex flex-col gap-5" data-testid="caregiver-punch">
      <PageHeader title={t("attendance.punch.title")} description={t("attendance.punch.description")} />
      {myQueue.length > 0 && <Card className="border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)] text-[var(--text-small)]" data-testid="punch-queue">
        <p className="font-medium">{t("attendance.punch.queueTitle", { count: myQueue.length })}</p>
        <p>{t("attendance.punch.queueDetail")}</p>
        <div className="mt-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void flush()}>{t("attendance.punch.sendNow")}</Button></div>
      </Card>}
      {current?.error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : !data ? <Skeleton className="h-48" /> : (
        <>
          <Card className="flex flex-col gap-2" data-testid="punch-consent">
            <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.consent.title")}</p>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("attendance.consent.body")}</p>
            {data.consent.accepted ? <div className="flex items-center gap-2"><Badge tone="success">{t("attendance.consent.accepted")}</Badge>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setConsent(false)}>{t("attendance.consent.revoke")}</Button></div>
              : <div><Button size="sm" variant="secondary" disabled={busy} onClick={() => void setConsent(true)}>{t("attendance.consent.accept")}</Button></div>}
          </Card>
          {data.shifts.length === 0 ? <EmptyState title={t("attendance.punch.noShiftsTitle")} description={t("attendance.punch.noShiftsDetail")} /> : shift && (
            <Card className="flex flex-col gap-3">
              {data.shifts.length > 1 && <Select label={t("attendance.punch.shift")} value={shift.shiftId} onChange={(e) => organizationId && setShiftChoice({ organizationId, shiftId: e.target.value })}>
                {data.shifts.map((s) => <option key={s.shiftId} value={s.shiftId}>{`${s.establishment.name} · ${fmt(s.scheduledStart, lang)}`}</option>)}
              </Select>}
              <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.punch.shiftLine", { name: shift.establishment.name, start: fmt(shift.scheduledStart, lang), end: fmt(shift.scheduledEnd, lang) })}</p>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{shift.openSession ? t("attendance.punch.sessionOpen") : t("attendance.punch.sessionClosed")}</p>
              {qr ? <Badge tone="success">{t("attendance.punch.qrReady")}</Badge>
                : <Input label={t("attendance.punch.pin")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} hint={t("attendance.punch.pinHint")} />}
              <div className="flex flex-wrap gap-2">
                {availablePunchTypes(shift).map((type, i) => (
                  <Button key={type} variant={i === 0 ? "primary" : "secondary"} disabled={busy || (!qr && pin.length !== 6)} onClick={() => void doPunch(type)}>{t(`attendance.punchType.${type}`)}</Button>
                ))}
              </div>
            </Card>
          )}
          {last && <Card className="flex flex-col gap-1 text-[var(--text-small)]" data-testid="punch-result">
            <p className="font-medium text-[var(--color-text-primary)]">{`${t(`attendance.punchType.${last.type}`)} · ${fmt(last.serverReceivedAt, lang)}`}</p>
            <div className="flex flex-wrap gap-1">
              <Badge tone={last.validation.effective === "validated" ? "success" : "warning"}>{t(`attendance.status.${last.validation.effective}`)}</Badge>
              <Badge tone="neutral">{t(`attendance.location.${last.location.status}`)}</Badge>
              <Badge tone="neutral">{t(`attendance.code.${last.code.status}`)}</Badge>
            </div>
            {last.validation.effective !== "validated" && <p className="text-[var(--color-text-secondary)]">{t("attendance.punch.pendingExplain")}</p>}
          </Card>}
          {shift && <CorrectionForm organizationId={organizationId!} shiftId={shift.shiftId} punches={data.recentPunches.filter((p) => p.shiftId === shift.shiftId)} />}
          <Card className="flex flex-col gap-1 text-[var(--text-small)]">
            <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.punch.recent")}</p>
            {data.recentPunches.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("attendance.punch.noRecent")}</p> : data.recentPunches.slice(0, 10).map((p) => (
              <p key={p.id}>{`${fmt(p.effectiveAt, lang)} · ${t(`attendance.punchType.${p.type}`)} · ${t(`attendance.status.${p.validation.effective}`)}`}</p>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function CorrectionForm({ organizationId, shiftId, punches }: { organizationId: string; shiftId: string; punches: Punch[] }) {
  const { t } = useTranslation("residential");
  const toast = useToast();
  const [openForm, setOpenForm] = useState(false);
  const [type, setType] = useState<PunchType>("in");
  const [punchId, setPunchId] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time) && reason.trim().length >= 3;
  const send = async () => {
    const token = getToken();
    if (!token || !valid) return;
    setBusy(true);
    try {
      // Hora local de Puerto Rico (UTC−4) → instante.
      await attendanceApi.requestCorrection(organizationId, { shiftId, ...(punchId ? { punchId } : {}), type, requestedAt: new Date(`${time}:00-04:00`).toISOString(), reason: reason.trim() }, token);
      toast.show(t("attendance.correction.sent"), "success"); setOpenForm(false); setReason(""); setTime(""); setPunchId("");
    } catch (e) { toast.show(attendanceErrorMessage(e), "danger"); }
    finally { setBusy(false); }
  };
  if (!openForm) return <div><Button variant="ghost" size="sm" onClick={() => setOpenForm(true)}>{t("attendance.correction.open")}</Button></div>;
  return (
    <Card className="flex flex-col gap-3" data-testid="punch-correction">
      <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.correction.title")}</p>
      <Select label={t("attendance.correction.which")} value={punchId} onChange={(e) => setPunchId(e.target.value)}>
        <option value="">{t("attendance.correction.missing")}</option>
        {punches.map((p) => <option key={p.id} value={p.id}>{`${t(`attendance.punchType.${p.type}`)} · ${new Date(p.effectiveAt).toLocaleTimeString()}`}</option>)}
      </Select>
      <Select label={t("attendance.correction.type")} value={type} onChange={(e) => setType(e.target.value as PunchType)}>
        {(["in", "out", "break_start", "break_end", "meal_start", "meal_end"] as const).map((x) => <option key={x} value={x}>{t(`attendance.punchType.${x}`)}</option>)}
      </Select>
      <Input label={t("attendance.correction.time")} type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
      <Textarea label={t("attendance.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2"><Button disabled={busy || !valid} onClick={() => void send()}>{t("attendance.correction.send")}</Button>
        <Button variant="ghost" onClick={() => setOpenForm(false)}>{t("attendance.cancel")}</Button></div>
    </Card>
  );
}
