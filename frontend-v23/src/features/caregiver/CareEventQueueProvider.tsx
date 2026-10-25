import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken, isKeptSession } from "@/auth/token";
import { createCareEvent, type CreateCareEventInput } from "@/api/careEvents";
import { checkIn as sendCheckIn, checkOut as sendCheckOut } from "@/api/shifts";
import type { ApiError } from "@/api/client";
import { declareEnRoute } from "@/api/journey";
import { recordArrival } from "@/api/serviceLocations";
import { MAX_AGE_MS, secureDelete, secureGet, secureSet } from "@/offline/secureStore";
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
const SECURE_QUEUE = "queue";

interface StoredQueue {
  userId: string;
  items: QueuedCareEvent[];
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

export function CareEventQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<QueuedCareEvent[]>([]);
  const [restored, setRestored] = useState(false);
  const [deliveredVersion, setDeliveredVersion] = useState(0);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const flushing = useRef(false);
  const persisted = isKeptSession();

  // Al abrir: recupera lo que quedó pendiente en este teléfono (cifrado),
  // solo del mismo usuario y de los últimos 7 días.
  useEffect(() => {
    let cancelled = false;
    if (!persisted || !userId) {
      Promise.resolve().then(() => { if (!cancelled) setRestored(true); });
      return () => { cancelled = true; };
    }
    secureGet<StoredQueue>(SECURE_QUEUE).then((stored) => {
      if (cancelled) return;
      const cutoff = Date.now() - MAX_AGE_MS;
      const kept = stored && stored.userId === userId
        ? stored.items
          .filter((item) => new Date(item.createdAt).getTime() > cutoff)
          .map((item) => item.status === "sending" ? { ...item, status: "pending" as const } : item)
        : [];
      if (kept.length > 0) setItems((current) => [...kept, ...current.filter((item) => !kept.some((k) => k.clientEventId === item.clientEventId))]);
      setRestored(true);
    });
    return () => { cancelled = true; };
  }, [persisted, userId]);

  // Cada cambio se guarda cifrado; sin pendientes, se borra del teléfono.
  useEffect(() => {
    if (!restored || !persisted || !userId) return;
    if (items.length === 0) void secureDelete(SECURE_QUEUE);
    else void secureSet(SECURE_QUEUE, { userId, items } satisfies StoredQueue);
  }, [items, restored, persisted, userId]);

  const update = useCallback((clientEventId: string, patch: Partial<QueuedCareEvent> | null) => {
    setItems((current) => patch === null
      ? current.filter((item) => item.clientEventId !== clientEventId)
      : current.map((item) => item.clientEventId === clientEventId ? { ...item, ...patch } : item));
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const token = getToken();
    if (!token) return;
    flushing.current = true;
    try {
      // En orden, uno a la vez: la actividad del turno conserva su secuencia.
      for (const item of itemsRef.current.filter((entry) => entry.status === "pending")) {
        update(item.clientEventId, { status: "sending" });
        try {
          await deliver(item, token);
          update(item.clientEventId, null);
          setDeliveredVersion((version) => version + 1);
        } catch (error) {
          if (isConnectivityError(error)) {
            update(item.clientEventId, { status: "pending" });
            break; // Sigue sin señal; se intenta luego.
          }
          update(item.clientEventId, { status: "failed", failure: failureMessage(error) });
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [update]);

  const pendingCount = items.filter((item) => item.status !== "failed").length;

  useEffect(() => {
    if (pendingCount === 0 || !restored) return;
    const onOnline = () => void flush();
    const onVisible = () => { if (document.visibilityState === "visible") void flush(); };
    // Guardado en el teléfono: cerrar la app ya no pierde nada.
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
  }, [pendingCount, flush, persisted, restored]);

  /** Envía ya si hay señal y nada delante; si no, encola (respeta el orden). */
  const enqueue = useCallback(async (entry: QueuedCareEvent): Promise<"sent" | "queued"> => {
    const token = getToken();
    if (token && navigator.onLine !== false && itemsRef.current.every((item) => item.status === "failed")) {
      try {
        await deliver(entry, token);
        return "sent";
      } catch (error) {
        if (!isConnectivityError(error)) throw error;
      }
    }
    // Llegada/salida que espera señal: el servidor la marca "sin conexión".
    if (entry.kind !== "care_event") entry.input = { ...entry.input, recordedOffline: true };
    setItems((current) => [...current, entry]);
    return "queued";
  }, []);

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

  const value = useMemo<CareEventQueueState>(() => ({
    items,
    deliveredVersion,
    persisted,
    submit,
    checkIn,
    checkOut,
    enRoute,
    arrive,
    retryNow: () => void flush(),
    discard: (clientEventId: string) => update(clientEventId, null),
  }), [items, deliveredVersion, persisted, submit, checkIn, checkOut, enRoute, arrive, flush, update]);

  return <CareEventQueueContext.Provider value={value}>{children}</CareEventQueueContext.Provider>;
}

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
}

/** Aviso fijo arriba mientras haya registros por enviar o que fallaron. */
export function CareEventQueueBanner() {
  const { items, retryNow, persisted } = useCareEventQueue();
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
