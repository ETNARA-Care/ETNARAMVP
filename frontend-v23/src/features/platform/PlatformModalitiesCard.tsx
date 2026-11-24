import { useCallback, useEffect, useState } from "react";
import { History, UserRound } from "lucide-react";
import { getToken } from "@/auth/token";
import { listPlatformModalities, setPlatformModality, type PlatformModality } from "@/api/platformModalities";
import { Button, Input, Skeleton, useToast } from "@/components/ui";
import { MODALITY_REASON_MAX, MODALITY_REASON_MIN, lockLines, modalityErrorMessage, reasonValid, stateNote, switchAvailable } from "./modalitySwitch";

/**
 * 163 · ETNARA Central: interruptor de la modalidad «Cuidador independiente».
 * Muestra solo el estado guardado; cambiarlo siempre pide motivo y queda en el historial (solo añadir).
 * Encender solo con la autorización del servidor y la autorización vigente de la base de datos (segundo candado);
 * apagar siempre. Solo gobierna los NUEVOS registros.
 */
export function PlatformModalitiesCard() {
  const toast = useToast();
  const [modality, setModality] = useState<PlatformModality | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setModality((await listPlatformModalities(token))[0] ?? null); setFailed(false); } catch { setFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    const token = getToken(); if (!token || !modality) return;
    setSaving(true);
    try {
      const target = !modality.enabled;
      await setPlatformModality(modality.code, target, reason.trim(), token);
      toast.show(target ? "Modalidad encendida." : "Modalidad apagada. Los proveedores ya registrados siguen operando.", "success");
      setEditing(false); setReason(""); await load();
    } catch (e) {
      toast.show(modalityErrorMessage((e as { code?: string })?.code), "danger");
    } finally { setSaving(false); }
  }

  const available = modality ? switchAvailable(modality) : false;
  return (
    <section data-ui="platform-modalities" aria-labelledby="platform-modalities-title"
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sage-100)] text-[var(--color-sage-800)]"><UserRound size={19} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="platform-modalities-title" className="font-sans text-[length:1rem] font-semibold leading-tight text-[var(--color-text-primary)]">Modalidad «Cuidador independiente»</h2>
          <p className="mt-1 text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]">
            Controla el registro de nuevos cuidadores independientes. Apagarla no interrumpe a los proveedores ya registrados. Cada cambio pide un motivo y queda en el historial.
          </p>
        </div>
      </div>

      {failed ? <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-danger-700)]">No se pudo cargar.</p> : !modality ? <Skeleton className="mt-4 h-20" /> : (
        <div className="mt-4 space-y-2.5">
          <div data-ui="modality-switch" data-state={modality.enabled ? "on" : "off"} data-activation={modality.activationAllowed ? "allowed" : "locked"}
            className={`rounded-2xl border bg-white p-3.5 ${editing ? "border-[var(--color-navy-700)] shadow-[0_0_0_3px_rgba(42,58,92,.12)]" : "border-[var(--color-border)]"}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className={`inline-flex items-center gap-1.5 text-[length:var(--text-caption)] font-semibold uppercase tracking-[.08em] ${modality.enabled ? "text-[var(--color-sage-700)]" : "text-[var(--color-text-muted)]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${modality.enabled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-slate-400)]"}`} aria-hidden />
                  {modality.enabled ? "Encendida" : "Apagada"}
                </p>
                <p className="mt-1 text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]" data-ui="modality-note">{stateNote(modality)}</p>
                <p className="mt-1 text-[length:var(--text-caption)] text-[var(--color-text-muted)]">Proveedores registrados: {modality.registeredOrganizations}</p>
                {!modality.enabled && (
                  <ul className="mt-1 space-y-0.5 text-[length:var(--text-caption)] text-[var(--color-text-muted)]" data-ui="modality-locks" data-db={modality.databaseUnlocked ? "unlocked" : "locked"}>
                    {lockLines(modality).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                )}
              </div>
              <button type="button" role="switch" aria-checked={modality.enabled} disabled={saving || !available}
                aria-label={`Cuidador independiente: ${modality.enabled ? "encendida. Apagar" : "apagada. Encender"} (pide motivo)`}
                onClick={() => { setEditing(!editing); setReason(""); }}
                className={`relative mt-0.5 inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-offset-2 ${modality.enabled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-ivory-200)] ring-1 ring-inset ring-[var(--color-slate-200)]"} disabled:cursor-not-allowed disabled:opacity-50`}>
                <span className={`h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(15,24,48,.25)] transition-transform ${modality.enabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            {editing && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <p className="text-[length:var(--text-small)] font-semibold text-[var(--color-text-primary)]">{modality.enabled ? "Apagar" : "Encender"} la modalidad «Cuidador independiente»</p>
                {modality.enabled && <p className="mt-1 text-[length:var(--text-caption)] leading-5 text-[var(--color-text-secondary)]">Solo se detienen los nuevos registros. Los proveedores ya registrados conservan su acceso, sus clientes, documentos, turnos e informes.</p>}
                <div className="mt-2">
                  <Input label={`Motivo (obligatorio, mínimo ${MODALITY_REASON_MIN} caracteres)`} value={reason} maxLength={MODALITY_REASON_MAX} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => { setEditing(false); setReason(""); }}>Cancelar</Button>
                  <Button size="sm" loading={saving} disabled={saving || !reasonValid(reason)} onClick={() => void save()}>{modality.enabled ? "Apagar" : "Encender"}</Button>
                </div>
              </div>
            )}
          </div>
          {modality.history.length > 0 && (
            <details className="rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-3 text-[length:var(--text-small)]">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-text-primary)]"><History size={15} />Historial ({modality.history.length})</summary>
              <ul className="mt-2 space-y-1.5" data-ui="modality-history">
                {modality.history.map((h, i) => (
                  <li key={i} className="leading-5 text-[var(--color-text-secondary)]">
                    <span className="font-medium text-[var(--color-text-primary)]">{h.newEnabled ? "Encendida" : "Apagada"}</span> · {new Date(h.occurredAt).toLocaleString("es-PR")} · {h.reason}{h.actorEmail ? ` · ${h.actorEmail}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
