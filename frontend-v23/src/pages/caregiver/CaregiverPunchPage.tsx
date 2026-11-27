import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { attendanceApi, attendanceErrorMessage, type MyAttendance, type Punch, type PunchInput, type PunchType } from "@/api/residentialAttendance";
import { availablePunchTypes, qrFromLink } from "@/features/residential/attendance";
import { addItem, classifyQueueError, mine, readAll, updateItem, withFlushLock, withQueueLock, MAX_PENDING, QUEUE_KEY_V2, type QueueItem, type QueueStorage } from "@/features/residential/attendanceQueue";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization } from "@/features/residential/modality";

/**
 * 173–175 (hogares F4): «Ponchar» del personal del hogar. Solo hogares y solo con HOGAR_PONCHES.
 * - El código llega por el QR impreso (abre esta pantalla con ?c=…) o se escribe el de 6 dígitos.
 * - La ubicación solo se lee al ponchar y solo con consentimiento vigente; el teléfono no la guarda.
 * - Sin conexión el ponche queda en el teléfono SIN ubicación y se envía después: el servidor lo deja pendiente de
 *   revisión. El servidor decide todo; esta pantalla solo muestra su respuesta.
 */
/** localStorage, o null si el navegador no lo permite (modo privado estricto, bloqueado…). */
const store = (): QueueStorage | null => { try { return window.localStorage; } catch { return null; } };
/** Hora local de Puerto Rico (UTC−4) para el campo de la corrección. */
const prLocalInput = (iso: string) => new Date(new Date(iso).getTime() - 4 * 3_600_000).toISOString().slice(0, 16);
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
  const { activeOrganization, user } = useAuth();
  const organizationId = activeOrganization?.id;
  const userId = user?.id ?? null;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_PONCHES");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const toast = useToast();
  const routeLocation = useLocation();
  // El QR llega en el fragmento (#c=…): se lee una vez y se quita de la barra de direcciones y del historial.
  // También si llega con la pantalla ya abierta (cambio de fragmento sin recargar).
  const [qr, setQr] = useState<string | null>(() => qrFromLink(routeLocation.hash || (typeof window !== "undefined" ? window.location.hash : "")));
  useEffect(() => {
    const take = () => {
      if (!/(^#|&)c=/.test(window.location.hash)) return;
      const v = qrFromLink(window.location.hash);
      if (v) setQr(v);
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    };
    take();
    window.addEventListener("hashchange", take);
    return () => window.removeEventListener("hashchange", take);
  }, []);
  const [state, setState] = useState<OrganizationScoped<MyAttendance> | null>(null);
  const [shiftChoice, setShiftChoice] = useState<{ organizationId: string; shiftId: string } | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ organizationId: string; punch: Punch } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>(() => readAll(store()));
  const [correctionFor, setCorrectionFor] = useState<string | null>(null);
  const [discardFor, setDiscardFor] = useState<string | null>(null);
  const refreshQueue = useCallback(() => setQueue(readAll(store())), []);
  // Otra pestaña del mismo teléfono cambió la cola: se vuelve a leer (nunca se escribe una copia antigua).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === QUEUE_KEY_V2 || e.key === null) refreshQueue(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshQueue]);
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
  // Solo los ponches de ESTA persona en ESTA organización (A1): los de otra persona del mismo teléfono no se ven ni se tocan.
  const myItems = organizationId && userId ? mine(queue, { userId, organizationId }) : [];
  const myQueue = myItems.filter((q) => q.status === "pending");
  const myRejected = myItems.filter((q) => q.status === "rejected");
  const holdAuth = myQueue.some((q) => q.hold === "auth"), holdFeature = myQueue.some((q) => q.hold === "feature");

  /**
   * Reenvía la cola de ESTA persona (mismo client_event_id: el servidor no duplica). Un solo envío a la vez en todo el
   * teléfono; cada cambio se hace con el candado y releyendo, así que un ponche nuevo guardado durante el envío no se
   * pierde. Solo se quita lo que el servidor aceptó; lo demás espera o queda «no aceptado» a la vista (A2, A5, A6).
   */
  const flush = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !userId || !token) return;
    const owner = { userId, organizationId };
    await withFlushLock(async () => {
      const tried = new Set<string>();
      for (;;) {
        const item = await withQueueLock(() => mine(readAll(store()), owner).find((i) => i.status === "pending" && !tried.has(i.clientEventId)));
        if (!item) break;
        tried.add(item.clientEventId);
        try {
          await attendanceApi.punch(organizationId, { clientEventId: item.clientEventId, shiftId: item.shiftId, type: item.type, method: item.method,
            ...(item.method === "qr" ? { qr: item.qr } : { pin: item.pin }), offline: true, declaredAt: item.declaredAt, deviceNow: new Date().toISOString() }, token);
          await withQueueLock(() => updateItem(store(), item.clientEventId, () => null));
        } catch (e) {
          const d = classifyQueueError(e);
          // Red, 5xx, 408 o 429: espera, y se detiene para no mandar los siguientes antes que este.
          if (d.kind === "retry") break;
          // 401 o asistencia apagada por ahora: espera con su explicación, sin perder nada.
          if (d.kind === "hold") { await withQueueLock(() => updateItem(store(), item.clientEventId, (i) => ({ ...i, hold: d.hold }))); break; }
          await withQueueLock(() => updateItem(store(), item.clientEventId, (i) => ({ ...i, status: "rejected", hold: undefined,
            rejection: { status: d.status, code: d.code, at: new Date().toISOString() } })));
        }
      }
    });
    refreshQueue(); await load();
  }, [organizationId, userId, load, refreshQueue]);
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    if (navigator.onLine && organizationId && userId && mine(readAll(store()), { userId, organizationId }).some((q) => q.status === "pending")) void flush();
    return () => window.removeEventListener("online", onOnline);
  }, [flush, organizationId, userId]);

  const doPunch = async (type: PunchType) => {
    const token = getToken();
    if (!organizationId || !userId || !token || !shift) return;
    const method: "qr" | "pin" = qr ? "qr" : "pin";
    if (method === "pin" && !/^\d{6}$/.test(pin)) return;
    setBusy(true);
    const clientEventId = crypto.randomUUID();
    const declaredAt = new Date().toISOString();
    const queued: QueueItem = { clientEventId, userId, organizationId, shiftId: shift.shiftId, type, method, ...(method === "qr" ? { qr: qr! } : { pin }), declaredAt, status: "pending" };
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
        // Se guarda con el candado y se comprueba releyendo: nunca un «guardado» falso (A3) ni un borrado silencioso (A4).
        const saved = await withQueueLock(() => addItem(store(), queued));
        refreshQueue();
        if (saved === "saved" || saved === "duplicate") { setPin(""); toast.show(t("attendance.punch.queued"), "warning"); }
        else if (saved === "full") toast.show(t("attendance.punch.queueFull", { max: MAX_PENDING }), "danger");
        else toast.show(t("attendance.punch.saveFailed"), "danger");
      } else {
        toast.show(attendanceErrorMessage(e), "danger");
      }
    } finally { setBusy(false); }
  };
  const retryRejected = async (id: string) => {
    await withQueueLock(() => updateItem(store(), id, (i) => ({ ...i, status: "pending", rejection: undefined })));
    refreshQueue(); void flush();
  };
  const discardRejected = async (id: string) => {
    await withQueueLock(() => updateItem(store(), id, () => null));
    setDiscardFor(null); refreshQueue();
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
        {holdAuth && <p data-testid="punch-hold-auth">{t("attendance.punch.holdAuth")}</p>}
        {holdFeature && <p data-testid="punch-hold-feature">{t("attendance.punch.holdFeature")}</p>}
        <div className="mt-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => void flush()}>{t("attendance.punch.sendNow")}</Button></div>
      </Card>}
      {myRejected.length > 0 && <Card className="flex flex-col gap-3 border-[var(--color-danger-700)]/40 text-[var(--text-small)]" data-testid="punch-rejected">
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{t("attendance.punch.rejectedTitle", { count: myRejected.length })}</p>
          <p className="text-[var(--color-text-secondary)]">{t("attendance.punch.rejectedDetail")}</p>
        </div>
        {myRejected.map((i) => (
          <div key={i.clientEventId} className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-2" data-testid="punch-rejected-item">
            <p className="font-medium">{`${t(`attendance.punchType.${i.type}`)} · ${fmt(i.declaredAt, lang)}`}</p>
            <p>{attendanceErrorMessage({ status: i.rejection?.status, code: i.rejection?.code ?? undefined })}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void retryRejected(i.clientEventId)}>{t("attendance.punch.retry")}</Button>
              <Button size="sm" variant="secondary" onClick={() => setCorrectionFor(correctionFor === i.clientEventId ? null : i.clientEventId)}>{t("attendance.correction.open")}</Button>
              {discardFor === i.clientEventId
                ? <Button size="sm" variant="ghost" onClick={() => void discardRejected(i.clientEventId)}>{t("attendance.punch.discardConfirm")}</Button>
                : <Button size="sm" variant="ghost" onClick={() => setDiscardFor(i.clientEventId)}>{t("attendance.punch.discard")}</Button>}
            </div>
            {correctionFor === i.clientEventId && organizationId && (
              <CorrectionForm organizationId={organizationId} shiftId={i.shiftId} punches={[]} initialOpen initialType={i.type} initialTime={prLocalInput(i.declaredAt)}
                onSent={() => { setCorrectionFor(null); void discardRejected(i.clientEventId); }} />
            )}
          </div>
        ))}
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

function CorrectionForm({ organizationId, shiftId, punches, initialOpen = false, initialType = "in", initialTime = "", onSent }: {
  organizationId: string; shiftId: string; punches: Punch[]; initialOpen?: boolean; initialType?: PunchType; initialTime?: string; onSent?: () => void;
}) {
  const { t } = useTranslation("residential");
  const toast = useToast();
  const [openForm, setOpenForm] = useState(initialOpen);
  const [type, setType] = useState<PunchType>(initialType);
  const [punchId, setPunchId] = useState("");
  const [time, setTime] = useState(initialTime);
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
      toast.show(t("attendance.correction.sent"), "success"); setOpenForm(false); setReason(""); setTime(""); setPunchId(""); onSent?.();
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
