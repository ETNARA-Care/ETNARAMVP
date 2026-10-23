import { useState } from "react";
import { CloudDownload, CircleCheck } from "lucide-react";
import { getToken, isKeptSession } from "@/auth/token";
import type { Shift } from "@/api/shifts";
import { isUpcoming, saveShiftCacheNow } from "@/offline/shiftCache";
import { useOfflineReady } from "./useOfflineReady";
import { prefetchShift } from "./prefetchShifts";

/** Marca pequeña para listas y tarjetas. Solo en sesiones de cuidador/a. */
export function OfflineReadyMark({ shiftId, onDark = false, compact = false }: { shiftId: string; onDark?: boolean; compact?: boolean }) {
  const ready = useOfflineReady(shiftId);
  if (!ready || !isKeptSession()) return null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium ${onDark ? "text-white/80" : "text-[var(--color-success-700)]"}`} title="Listo para usar sin señal">
      <CircleCheck size={14} aria-hidden />{compact ? "Listo sin señal" : "Listo para usar sin señal"}
    </span>
  );
}

/**
 * En el detalle del turno: confirma que está listo o permite descargarlo
 * antes de salir (como bajar el expediente antes de la visita).
 */
export function OfflineReadyCard({ organizationId, shift }: { organizationId: string; shift: Shift }) {
  const ready = useOfflineReady(shift.id);
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  if (!isKeptSession() || !isUpcoming(shift)) return null;

  async function download() {
    const token = getToken();
    if (!token) return;
    setState("loading");
    const complete = await prefetchShift(organizationId, shift, token);
    const saved = complete && await saveShiftCacheNow();
    setState(saved ? "idle" : "failed");
  }

  if (ready) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-3 text-sm text-[var(--color-success-700)]">
        <CircleCheck size={18} aria-hidden className="shrink-0" />
        <span><span className="font-semibold">Listo para usar sin señal.</span> <span className="text-[var(--color-text-secondary)]">Este turno está guardado en tu teléfono.</span></span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-3">
      <p className="text-sm text-[var(--color-text-secondary)]">Descárgalo antes de salir por si no hay señal en la casa.</p>
      <button
        type="button"
        onClick={() => void download()}
        disabled={state === "loading"}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-navy-900)] px-3 text-sm font-semibold text-[var(--color-navy-900)] disabled:opacity-50"
      >
        <CloudDownload size={18} aria-hidden />{state === "loading" ? "Descargando…" : "Descargar para usar sin señal"}
      </button>
      {state === "failed" && <p role="alert" className="text-xs text-[var(--color-danger-700)]">No se pudo descargar. Necesitas señal; intenta de nuevo.</p>}
    </div>
  );
}
