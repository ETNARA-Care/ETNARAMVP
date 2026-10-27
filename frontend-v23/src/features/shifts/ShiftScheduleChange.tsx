import { useCallback, useEffect, useState } from "react";
import { CalendarClock, History } from "lucide-react";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { correctShiftSchedule, listShiftScheduleCorrections, updateShift, type Shift, type ShiftScheduleCorrection } from "@/api/shifts";
import { Button, Card, Input, Modal, Textarea, useToast } from "@/components/ui";

function localDateTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const fmt = (iso: string) => new Date(iso).toLocaleString("es-PR", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Un turno ya comenzó: pasó su hora de inicio, está en curso, terminado o cancelado (Backend #235, 135). */
function shiftHasStarted(shift: Pick<Shift, "scheduled_start" | "status">, now = Date.now()): boolean {
  return shift.status === "in_progress" || shift.status === "completed" || shift.status === "cancelled"
    || new Date(shift.scheduled_start).getTime() <= now;
}

/**
 * «Cambiar horario» (administración y supervisión) antes del inicio, con confirmación;
 * el backend avisa a la cuidadora y lo registra (133). Después del inicio solo la
 * administración puede hacer una corrección excepcional con motivo (135); los marcajes
 * originales no se tocan. Muestra el historial de correcciones.
 */
export function ShiftScheduleChange({ organizationId, shift, isAdmin, onChanged }: {
  organizationId: string; shift: Shift; isAdmin: boolean; onChanged: (shift: Shift) => void;
}) {
  const { show } = useToast();
  const started = shiftHasStarted(shift);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [times, setTimes] = useState({ start: localDateTime(shift.scheduled_start), end: localDateTime(shift.scheduled_end) });
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<ShiftScheduleCorrection[]>([]);

  const loadHistory = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try { setHistory(await listShiftScheduleCorrections(organizationId, shift.id, token)); } catch { setHistory([]); }
  }, [organizationId, shift.id]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const startIso = times.start ? new Date(times.start).toISOString() : "";
  const endIso = times.end ? new Date(times.end).toISOString() : "";
  const validTimes = Boolean(startIso && endIso) && new Date(startIso) < new Date(endIso);
  const reasonOk = reason.trim().length >= 10;

  function openEditor() {
    setTimes({ start: localDateTime(shift.scheduled_start), end: localDateTime(shift.scheduled_end) });
    setReason("");
    setConfirming(false);
    setOpen(true);
  }

  async function save() {
    const token = getToken();
    if (!token || !validTimes) return;
    setSaving(true);
    try {
      if (started) {
        const result = await correctShiftSchedule(organizationId, shift.id, { scheduledStart: startIso, scheduledEnd: endIso, reason: reason.trim() }, token);
        onChanged(result.shift);
        show("Corrección registrada con su motivo. Avisamos a la cuidadora.", "success");
      } else {
        onChanged(await updateShift(organizationId, shift.id, { scheduledStart: startIso, scheduledEnd: endIso }, token));
        show("Horario actualizado. Avisamos a la cuidadora asignada.", "success");
      }
      setOpen(false);
      void loadHistory();
    } catch (requestError) {
      const code = (requestError as ApiError)?.code;
      show(code === "SHIFT_SCHEDULE_LOCKED" ? "El turno ya comenzó: el horario solo se corrige como excepción de la administración."
        : code === "SHIFT_CORRECTION_FORBIDDEN" ? "Solo la administración puede corregir un turno que ya comenzó."
        : code === "INVALID_SHIFT_TIMES" || code === "SHIFT_CORRECTION_INVALID_TIMES" ? "La salida debe ser después de la entrada."
        : "No pudimos cambiar el horario. Intenta nuevamente.", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (shift.status === "cancelled") return null;
  const canEdit = !started || isAdmin;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <CalendarClock size={20} className="mt-0.5 text-[var(--color-text-muted)]" aria-hidden />
        <div className="flex-1">
          <p className="font-medium text-[var(--color-text-primary)]">Horario</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {started
              ? isAdmin ? "El turno ya comenzó. Solo se corrige como excepción, con motivo; los marcajes no cambian." : "El turno ya comenzó. Solo la administración puede corregir el horario."
              : "Puedes cambiarlo antes de que comience. La cuidadora recibe un aviso."}
          </p>
        </div>
        {canEdit && <Button variant="secondary" onClick={openEditor}>{started ? "Corregir horario" : "Cambiar horario"}</Button>}
      </div>
      {history.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
          <p className="flex items-center gap-2 text-[var(--text-small)] font-medium"><History size={16} aria-hidden />Correcciones excepcionales</p>
          {history.map((c) => (
            <p key={c.id} className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
              {fmt(c.corrected_at)}: {fmt(c.previous_start)}–{fmt(c.previous_end)} → {fmt(c.new_start)}–{fmt(c.new_end)}. Motivo: {c.reason}
            </p>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => !saving && setOpen(false)} title={started ? "Corrección excepcional de horario" : "Cambiar horario"}
        footer={confirming
          ? <><Button variant="secondary" disabled={saving} onClick={() => setConfirming(false)}>Volver</Button><Button loading={saving} onClick={() => void save()}>Confirmar cambio</Button></>
          : <><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={!validTimes || (started && !reasonOk)} onClick={() => setConfirming(true)}>Continuar</Button></>}>
        {confirming ? (
          <div className="flex flex-col gap-2 text-[var(--text-body)]">
            <p>Horario actual: <strong>{fmt(shift.scheduled_start)} – {fmt(shift.scheduled_end)}</strong></p>
            <p>Nuevo horario: <strong>{fmt(startIso)} – {fmt(endIso)}</strong></p>
            {started && <p>Motivo: {reason.trim()}</p>}
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">La cuidadora asignada recibirá un aviso y el cambio queda registrado en el historial.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input label="Entrada" type="datetime-local" value={times.start} onChange={(e) => setTimes((t) => ({ ...t, start: e.target.value }))} required />
            <Input label="Salida" type="datetime-local" value={times.end} onChange={(e) => setTimes((t) => ({ ...t, end: e.target.value }))} required />
            {started && <Textarea label="Motivo (obligatorio)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: la familia pidió extender la visita" />}
            {!validTimes && <p className="text-[var(--text-small)] text-[var(--color-danger-700)]">La salida debe ser después de la entrada.</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}
