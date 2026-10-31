import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { createCareEvent, type CreateCareEventInput } from "@/api/careEvents";
import { checkIn as sendCheckIn, checkOut as sendCheckOut } from "@/api/shifts";
import type { ApiError } from "@/api/client";
import { declareEnRoute } from "@/api/journey";
import { recordArrival } from "@/api/serviceLocations";
import { discardPending, loadPending, migrateLegacyQueue, savePending } from "@/offline/pendingVault";
import { secureStoreAvailable } from "@/offline/secureStore";
import {
  CareEventQueueContext,
  failureMessage,
  isConnectivityError,
  useCareEventQueue,
  type CareEventQueueState,
  type QueuedCareEvent,
  type QueuedKind,
  type VisitEventInput,
} from "./careEventQueue";

const RETRY_INTERVAL_MS = 15_000;

/** 401: la sesión terminó (vencida, revocada o cerrada en otro lugar). No es un rechazo del registro. */
function isSessionEnded(error: unknown): boolean {
  return (error as ApiError)?.status === 401;
}

async function deliver(item: QueuedCareEvent, token: string): Promise<void> {
  if (item.kind === "check_in") return sendCheckIn(item.organizationId, item.shiftId, token, item.input as VisitEventInput);
  if (item.kind === "check_out") return sendCheckOut(item.organizationId, item.shiftId, token, item.input as VisitEventInput);
  // Gate 7: same id and real time on every retry -> the server stores it once.
  // "Already arrived" means the visit already moved past this record: delivered, nothing to show.
  const done = (e: unknown) => { if (!["ALREADY_ARRIVED", "JOURNEY_ALREADY_ARRIVED"].includes((e as ApiError)?.code ?? "")) throw e; };
  if (item.kind === "en_route") { await declareEnRoute(item.organizationId, item.shiftId, token, item.input as VisitEventInput).catch(done); return; }
  // Without signal no location is read: the arrival is stored for the agency's review.
  if (item.kind === "arrival") { await recordArrival(item.organizationId, item.shiftId, null, token, item.input as VisitEventInput).catch(done); return; }
  await createCareEvent(item.organizationId, item.shiftId, item.input as CreateCareEventInput, token);
}

function newEntry(kind: QueuedKind, organizationId: string, shiftId: string, label: string, input: Record<string, unknown> = {}): QueuedCareEvent {
  const clientEventId = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    clientEventId,
    kind,
    organizationId,
    shiftId,
    label,
    status: "pending",
    createdAt: now,
    input: { ...input, clientEventId, occurredAt: now },
  };
}

/** La cola en memoria siempre dice de qué cuenta es: nunca se guarda ni se envía con otra. */
interface OwnedQueue {
  owner: string | null;
  items: QueuedCareEvent[];
  /** Ya se leyó la bóveda de `owner`. Antes no se guarda nada (no pisar lo guardado). */
  ready: boolean;
}

/**
 * C3 (auditoría 31-oct-2026):
 * - Los registros pendientes se guardan cifrados en la bóveda de SU cuenta (offline/pendingVault),
 *   en toda sesión de cuidador/a, y se borran al enviarse, al descartarlos o a los 7 días.
 * - Un 401 (sesión vencida o revocada) NO los marca como fallidos ni los borra: vuelven a
 *   «pendiente», se deja de enviar y se avisa para entrar de nuevo con la misma cuenta.
 * - Otra cuenta en el mismo teléfono solo abre su propia bóveda: no ve, no envía y no pisa
 *   los registros de nadie más.
 */
export function CareEventQueueProvider({ children }: { children: ReactNode }) {
  const { user, endSession } = useAuth();
  const userId = user?.id ?? null;
  const [queue, setQueue] = useState<OwnedQueue>({ owner: userId, items: [], ready: false });
  const [sessionEnded, setSessionEnded] = useState(false);
  const [deliveredVersion, setDeliveredVersion] = useState(0);
  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  const userRef = useRef(userId);
  useEffect(() => { userRef.current = userId; }, [userId]);
  const flushing = useRef(false);
  const persisted = secureStoreAvailable();

  // Al abrir o al cambiar de cuenta: se cambia de dueña ANTES de leer y solo se lee su bóveda.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setSessionEnded(false);
      setQueue((current) => current.owner === userId ? { ...current, ready: false } : { owner: userId, items: [], ready: false });
    });
    if (!userId) return () => { cancelled = true; };
    void (async () => {
      await migrateLegacyQueue<QueuedCareEvent>();
      const stored = await loadPending<QueuedCareEvent>(userId);
      if (cancelled) return;
      setQueue((current) => {
        if (current.owner !== userId) return current;
        const fresh = current.items.filter((item) => !stored.some((s) => s.clientEventId === item.clientEventId));
        return { owner: userId, items: [...stored, ...fresh], ready: true };
      });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Cada cambio se guarda cifrado en la bóveda de su dueña; vacía, se borra con su llave.
  useEffect(() => {
    if (!queue.ready || !queue.owner) return;
    void savePending(queue.owner, queue.items);
  }, [queue]);

  const mine = queue.owner === userId ? queue.items : [];

  const update = useCallback((owner: string, clientEventId: string, patch: Partial<QueuedCareEvent> | null) => {
    setQueue((current) => current.owner !== owner ? current : {
      ...current,
      items: patch === null
        ? current.items.filter((item) => item.clientEventId !== clientEventId)
        : current.items.map((item) => item.clientEventId === clientEventId ? { ...item, ...patch } : item),
    });
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const owner = userRef.current;
    const token = getToken();
    const current = queueRef.current;
    if (!token || !owner || current.owner !== owner || !current.ready) return;
    flushing.current = true;
    try {
      // En orden, uno a la vez: la actividad del turno conserva su secuencia.
      for (const item of current.items.filter((entry) => entry.status === "pending")) {
        if (userRef.current !== owner) break; // cambió la cuenta: nada más se envía con este token
        update(owner, item.clientEventId, { status: "sending" });
        try {
          await deliver(item, token);
          update(owner, item.clientEventId, null);
          setDeliveredVersion((version) => version + 1);
        } catch (error) {
          if (isConnectivityError(error)) {
            update(owner, item.clientEventId, { status: "pending" });
            break; // Sigue sin señal; se intenta luego.
          }
          if (isSessionEnded(error)) {
            update(owner, item.clientEventId, { status: "pending" });
            setSessionEnded(true);
            break; // Se conservan; se envían cuando ella vuelva a entrar.
          }
          update(owner, item.clientEventId, { status: "failed", failure: failureMessage(error) });
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [update]);

  const pendingCount = mine.filter((item) => item.status !== "failed").length;

  useEffect(() => {
    if (pendingCount === 0 || !queue.ready || sessionEnded) return;
    const onOnline = () => void flush();
    const onVisible = () => { if (document.visibilityState === "visible") void flush(); };
    // Guardado cifrado en el teléfono; si el almacenamiento no existe, se pide no cerrar la app.
    const onBeforeUnload = (event: BeforeUnloadEvent) => { if (!persisted) event.preventDefault(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    const timer = window.setInterval(() => void flush(), RETRY_INTERVAL_MS);
    const first = window.setTimeout(() => void flush(), 0);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [pendingCount, flush, persisted, queue.ready, sessionEnded]);

  /** Envía ya si hay señal y nada delante; si no, encola (respeta el orden). */
  const enqueue = useCallback(async (entry: QueuedCareEvent): Promise<"sent" | "queued"> => {
    const owner = userRef.current;
    if (!owner) throw new Error("NO_SESSION");
    const token = getToken();
    if (token && !sessionEnded && navigator.onLine !== false && queueRef.current.items.every((item) => item.status === "failed")) {
      try {
        await deliver(entry, token);
        return "sent";
      } catch (error) {
        if (isSessionEnded(error)) setSessionEnded(true);
        else if (!isConnectivityError(error)) throw error;
      }
    }
    // Llegada/salida que espera señal: el servidor la marca "sin conexión".
    if (entry.kind !== "care_event") entry.input = { ...entry.input, recordedOffline: true };
    setQueue((current) => current.owner !== owner ? current : { ...current, items: [...current.items, entry] });
    return "queued";
  }, [sessionEnded]);

  const submit = useCallback<CareEventQueueState["submit"]>(({ organizationId, shiftId, label, input }) => {
    const entry = newEntry("care_event", organizationId, shiftId, label, input as unknown as Record<string, unknown>);
    entry.typeCode = input.typeCode;
    return enqueue(entry);
  }, [enqueue]);

  const checkIn = useCallback<CareEventQueueState["checkIn"]>((organizationId, shiftId) =>
    enqueue(newEntry("check_in", organizationId, shiftId, "Inicio del turno")), [enqueue]);
  const checkOut = useCallback<CareEventQueueState["checkOut"]>((organizationId, shiftId) =>
    enqueue(newEntry("check_out", organizationId, shiftId, "Final del turno")), [enqueue]);
  const enRoute = useCallback<CareEventQueueState["enRoute"]>((organizationId, shiftId) =>
    enqueue(newEntry("en_route", organizationId, shiftId, "Voy en camino")), [enqueue]);
  const arrive = useCallback<CareEventQueueState["arrive"]>((organizationId, shiftId) =>
    enqueue(newEntry("arrival", organizationId, shiftId, "Llegué")), [enqueue]);

  /** Descarta TODOS los registros de esta cuenta (lo confirma ella): se borran con su llave. */
  const discardAll = useCallback(async () => {
    const owner = userRef.current;
    if (!owner) return;
    setQueue((current) => current.owner !== owner ? current : { ...current, items: [] });
    await discardPending(owner);
  }, []);

  const value = useMemo<CareEventQueueState>(() => ({
    items: mine,
    deliveredVersion,
    persisted,
    sessionEnded,
    submit,
    checkIn,
    checkOut,
    enRoute,
    arrive,
    retryNow: () => void flush(),
    discard: (clientEventId: string) => { if (userId) update(userId, clientEventId, null); },
    discardAll,
    signInAgain: () => endSession(),
  }), [mine, deliveredVersion, persisted, sessionEnded, submit, checkIn, checkOut, enRoute, arrive, flush, update, userId, discardAll, endSession]);

  return <CareEventQueueContext.Provider value={value}>{children}</CareEventQueueContext.Provider>;
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
}

/** Aviso fijo arriba mientras haya registros por enviar o que fallaron. */
export function CareEventQueueBanner() {
  const { items, retryNow, persisted, sessionEnded, signInAgain } = useCareEventQueue();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const waiting = items.filter((item) => item.status !== "failed");
  const failed = items.filter((item) => item.status === "failed");
  if (items.length === 0) {
    if (online) return null;
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 pt-3 sm:px-6">
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <CloudOff size={20} aria-hidden className="shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            Sin señal
            <span className="block text-xs font-normal text-amber-800">Ves la última información. Lo que registres se guarda y se envía cuando vuelva la señal.</span>
          </p>
        </div>
      </div>
    );
  }
  const sending = waiting.some((item) => item.status === "sending");
  if (sessionEnded && waiting.length > 0) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 pt-3 sm:px-6">
        <div role="alert" data-testid="queue-session-ended" className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <TriangleAlert size={20} aria-hidden className="shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            Tu sesión terminó · {waiting.length} {waiting.length === 1 ? "registro sigue guardado" : "registros siguen guardados"}
            <span className="block text-xs font-normal text-amber-800">Están cifrados en este teléfono para tu cuenta. Entra de nuevo con tu cuenta y se envían solos.</span>
          </p>
          <button type="button" onClick={signInAgain} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold">Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-3 sm:px-6">
      {waiting.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <CloudOff size={20} aria-hidden className="shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {sending ? "Enviando registros…" : `Sin señal · ${waiting.length} ${waiting.length === 1 ? "registro" : "registros"} por enviar`}
            <span className="block text-xs font-normal text-amber-800">{persisted ? "Guardados en este teléfono. Se envían solos cuando vuelva la señal." : "Se envían solos cuando vuelva la señal. No cierres la app."}</span>
          </p>
          <button type="button" onClick={retryNow} disabled={sending} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold disabled:opacity-50">
            <RefreshCw size={16} aria-hidden />Reintentar
          </button>
        </div>
      )}
      {failed.length > 0 && (
        <div role="alert" className="mt-2 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-900">
          <TriangleAlert size={20} aria-hidden className="shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {failed.length === 1 ? "1 registro no se pudo enviar" : `${failed.length} registros no se pudieron enviar`}
            <span className="block text-xs font-normal text-red-800">Revísalo en el turno y avisa a Administración.</span>
          </p>
          <Link to={`/caregiver/shifts/${failed[0].shiftId}`} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold">Ver</Link>
        </div>
      )}
    </div>
  );
}
