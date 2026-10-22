import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { getToken } from "@/auth/token";
import { createCareEvent } from "@/api/careEvents";
import {
  CareEventQueueContext,
  failureMessage,
  isConnectivityError,
  useCareEventQueue,
  type CareEventQueueState,
  type QueuedCareEvent,
} from "./careEventQueue";

const RETRY_INTERVAL_MS = 15_000;

export function CareEventQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QueuedCareEvent[]>([]);
  const [deliveredVersion, setDeliveredVersion] = useState(0);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const flushing = useRef(false);

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
          await createCareEvent(item.organizationId, item.shiftId, item.input, token);
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
    if (pendingCount === 0) return;
    const onOnline = () => void flush();
    const onVisible = () => { if (document.visibilityState === "visible") void flush(); };
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    const timer = window.setInterval(() => void flush(), RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(timer);
    };
  }, [pendingCount, flush]);

  const submit = useCallback<CareEventQueueState["submit"]>(async ({ organizationId, shiftId, label, input }) => {
    const entry: QueuedCareEvent = {
      clientEventId: crypto.randomUUID(),
      organizationId,
      shiftId,
      typeCode: input.typeCode,
      label,
      status: "pending",
      input: { ...input, occurredAt: new Date().toISOString() },
    };
    entry.input.clientEventId = entry.clientEventId;
    const token = getToken();
    // Con otros pendientes delante, se encola para respetar el orden.
    if (token && navigator.onLine !== false && itemsRef.current.every((item) => item.status === "failed")) {
      try {
        await createCareEvent(organizationId, shiftId, entry.input, token);
        return "sent";
      } catch (error) {
        if (!isConnectivityError(error)) throw error;
      }
    }
    setItems((current) => [...current, entry]);
    return "queued";
  }, []);

  const value = useMemo<CareEventQueueState>(() => ({
    items,
    deliveredVersion,
    submit,
    retryNow: () => void flush(),
    discard: (clientEventId: string) => update(clientEventId, null),
  }), [items, deliveredVersion, submit, flush, update]);

  return <CareEventQueueContext.Provider value={value}>{children}</CareEventQueueContext.Provider>;
}

/** Aviso fijo arriba mientras haya registros por enviar o que fallaron. */
export function CareEventQueueBanner() {
  const { items, retryNow } = useCareEventQueue();
  const waiting = items.filter((item) => item.status !== "failed");
  const failed = items.filter((item) => item.status === "failed");
  if (items.length === 0) return null;
  const sending = waiting.some((item) => item.status === "sending");

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pt-3 sm:px-6">
      {waiting.length > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <CloudOff size={20} aria-hidden className="shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            {sending ? "Enviando registros…" : `Sin señal · ${waiting.length} ${waiting.length === 1 ? "registro" : "registros"} por enviar`}
            <span className="block text-xs font-normal text-amber-800">Se envían solos cuando vuelva la señal. No cierres la app.</span>
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
