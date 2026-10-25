import { useCallback, useEffect, useState } from "react";
import { FlaskConical, History } from "lucide-react";
import { getToken } from "@/auth/token";
import { getOrganizationFeatures, setOrganizationFeature, type OrganizationFeatures, type PilotFeatureCode } from "@/api/platformOrganizations";
import { Button, Input, Skeleton, useToast } from "@/components/ui";
import { BillingManagerPanel } from "./BillingManagerPanel";

const LABELS: Record<PilotFeatureCode, { title: string; detail: string }> = {
  SMARTMATCH: { title: "SmartMatch", detail: "Oportunidades, postulaciones y turnos desde SmartMatch." },
  EN_CAMINO: { title: "En camino y «Llegué»", detail: "Aviso de salida, retrasos declarados y llegada con ubicación." },
  FINANZAS: { title: "Finanzas", detail: "Servicios y tarifas de la agencia. ETNARA central solo enciende o apaga: no ve importes ni datos financieros." },
  FACTURACION: { title: "Facturación Premium", detail: "Facturas de la agencia a sus clientes. Requiere Finanzas. ETNARA central solo enciende, apaga y designa al gestor de permisos: no ve facturas, tarifas ni importes." },
  SHIFT_REPORTS: { title: "Informe de turno", detail: "Informe de cada visita con sus registros reales, revisado y aprobado por la agencia. ETNARA central solo enciende o apaga: no ve el contenido de los informes." },
};
const ORDER: PilotFeatureCode[] = ["SMARTMATCH", "EN_CAMINO", "FINANZAS", "FACTURACION", "SHIFT_REPORTS"];

/**
 * ETNARA central: turn the SmartMatch pilot on or off for one agency.
 * The switch only shows the saved state; changing it always goes through the
 * confirmation with a mandatory reason (audited, append-only history).
 */
export function OrganizationFeaturesCard({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [data, setData] = useState<OrganizationFeatures | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<{ code: PilotFeatureCode; enabled: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setData(await getOrganizationFeatures(organizationId, token)); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    const token = getToken(); if (!token || !editing) return;
    setSaving(true);
    try {
      await setOrganizationFeature(organizationId, editing.code, editing.enabled, reason.trim(), token);
      toast.show(editing.enabled ? "Función activada." : "Función desactivada.", "success");
      setEditing(null); setReason(""); await load();
    } catch (e) {
      toast.show((e as { code?: string })?.code === "FEATURE_REQUIRES_FINANZAS" ? "Facturación requiere Finanzas activo." : "No se pudo guardar el cambio.", "danger");
    } finally { setSaving(false); }
  }

  // Only switches this screen knows how to describe: a code added by a newer backend
  // (e.g. ACTIVITY_PHOTOS) is skipped instead of breaking the whole card.
  const features = data ? data.features.filter((f) => f.code in LABELS).sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code)) : [];
  const history = data ? data.history.filter((h) => h.code in LABELS) : [];
  const activeCount = features.filter((f) => f.enabled).length;
  const finanzasOn = features.some((f) => f.code === "FINANZAS" && f.enabled);
  const facturacionOn = features.some((f) => f.code === "FACTURACION" && f.enabled);

  return (
    <section data-ui="pilot-features" aria-labelledby={`pilot-${organizationId}`}
      className="rounded-[1.25rem] border border-[var(--color-sage-200)] bg-[var(--color-sage-50)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sage-100)] text-[var(--color-sage-800)]"><FlaskConical size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={`pilot-${organizationId}`} className="font-sans text-[length:1rem] font-semibold leading-tight text-[var(--color-text-primary)]">Funciones piloto</h3>
            {data && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[length:var(--text-caption)] font-semibold text-[var(--color-text-secondary)]">{activeCount} de {features.length} activas</span>}
          </div>
          <p className="mt-1 text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]">Apagadas por defecto. Solo la agencia piloto las ve. Cada cambio pide un motivo y queda en el historial.</p>
        </div>
      </div>

      {failed ? <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-danger-700)]">No se pudieron cargar.</p> : !data ? <Skeleton className="mt-4 h-28" /> : (
        <div className="mt-4 space-y-2.5">
          {features.map((f) => {
            const label = LABELS[f.code];
            const pending = editing?.code === f.code;
            // FACTURACION needs FINANZAS (the backend and the database refuse it too).
            const blocked = f.code === "FACTURACION" && !f.enabled && !finanzasOn;
            return (
              <div key={f.code} data-ui="pilot-feature" data-code={f.code} data-state={f.enabled ? "on" : "off"}
                className={`rounded-2xl border bg-white p-3.5 transition-shadow ${pending ? "border-[var(--color-navy-700)] shadow-[0_0_0_3px_rgba(42,58,92,.12)]" : "border-[var(--color-border)]"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-sans text-[length:0.9375rem] font-semibold leading-snug text-[var(--color-text-primary)]">{label.title}</div>
                    <p className="mt-0.5 text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]">{label.detail}</p>
                    <p className={`mt-1.5 inline-flex items-center gap-1.5 text-[length:var(--text-caption)] font-semibold uppercase tracking-[.08em] ${f.enabled ? "text-[var(--color-sage-700)]" : "text-[var(--color-text-muted)]"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${f.enabled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-slate-400)]"}`} aria-hidden />
                      {f.enabled ? "Activa" : "Apagada"}
                    </p>
                    {blocked && <p className="mt-1 text-[length:var(--text-caption)] text-[var(--color-text-muted)]" data-ui="requires-finanzas">Requiere Finanzas activo.</p>}
                  </div>
                  <button type="button" role="switch" aria-checked={f.enabled} disabled={saving || blocked}
                    aria-label={`${label.title}: ${f.enabled ? "activa" : "apagada"}. ${f.enabled ? "Desactivar" : "Activar"} (pide motivo)`}
                    onClick={() => { setEditing(pending ? null : { code: f.code, enabled: !f.enabled }); setReason(""); }}
                    className={`relative mt-0.5 inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-offset-2 ${f.enabled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-ivory-200)] ring-1 ring-inset ring-[var(--color-slate-200)]"} disabled:cursor-not-allowed disabled:opacity-50`}>
                    <span className={`h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(15,24,48,.25)] transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {pending && editing && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <p className="text-[length:var(--text-small)] font-semibold text-[var(--color-text-primary)]">
                      {editing.enabled ? "Activar" : "Desactivar"} {label.title} para esta agencia
                    </p>
                    {editing.code === "FINANZAS" && !editing.enabled && facturacionOn && (
                      <p className="mt-1 text-[length:var(--text-caption)] leading-5 text-[var(--color-text-secondary)]">Facturación Premium quedará en modo consulta: el historial se conserva, sin nuevas facturas.</p>
                    )}
                    <div className="mt-2">
                      <Input label="Motivo (obligatorio)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                      <Button size="sm" variant="secondary" disabled={saving} onClick={() => { setEditing(null); setReason(""); }}>Cancelar</Button>
                      <Button size="sm" loading={saving} disabled={saving || reason.trim().length < 3} onClick={() => void save()}>
                        {editing.enabled ? "Activar" : "Desactivar"}
                      </Button>
                    </div>
                  </div>
                )}
                {f.code === "FACTURACION" && f.enabled && finanzasOn && !pending && <BillingManagerPanel organizationId={organizationId} />}
              </div>
            );
          })}
          {history.length > 0 && (
            <details className="group rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-3 text-[length:var(--text-small)]">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-text-primary)]"><History size={15} />Historial ({history.length})</summary>
              <ul className="mt-2 space-y-1.5">
                {history.map((h, i) => (
                  <li key={i} className="leading-5 text-[var(--color-text-secondary)]">
                    <span className="font-medium text-[var(--color-text-primary)]">{LABELS[h.code].title} {h.enabled ? "activada" : "desactivada"}</span> · {new Date(h.occurredAt).toLocaleString("es-PR")} · {h.reason}{h.actorEmail ? ` · ${h.actorEmail}` : ""}
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
