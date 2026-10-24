import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { getOrganizationFeatures, setOrganizationFeature, type OrganizationFeatures, type PilotFeatureCode } from "@/api/platformOrganizations";
import { Badge, Button, Card, Input, Skeleton, useToast } from "@/components/ui";

const LABELS: Record<PilotFeatureCode, { title: string; detail: string }> = {
  SMARTMATCH: { title: "SmartMatch", detail: "Oportunidades, postulaciones y turnos desde SmartMatch." },
  EN_CAMINO: { title: "En camino y «Llegué»", detail: "Aviso de salida, retrasos declarados y llegada con ubicación." },
};

/** ETNARA central: turn the SmartMatch pilot on or off for one agency (reason required, audited). */
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
    } catch {
      toast.show("No se pudo guardar el cambio.", "danger");
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <h3 className="font-semibold">Funciones piloto</h3>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Apagadas por defecto. Solo la agencia piloto las ve.</p>
      {failed ? <p className="mt-3 text-sm text-[var(--color-danger-700)]">No se pudieron cargar.</p> : !data ? <Skeleton className="mt-3 h-20" /> : (
        <div className="mt-3 space-y-3">
          {data.features.map((f) => (
            <div key={f.code} className="rounded-xl border border-[var(--color-border)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{LABELS[f.code].title}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">{LABELS[f.code].detail}</div>
                </div>
                <Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? "Activa" : "Apagada"}</Badge>
              </div>
              {editing?.code === f.code ? (
                <div className="mt-3 space-y-2">
                  <Input label="Motivo (obligatorio)" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={saving} onClick={() => { setEditing(null); setReason(""); }}>Cancelar</Button>
                    <Button loading={saving} disabled={saving || reason.trim().length < 3} onClick={() => void save()}>
                      {editing.enabled ? "Activar" : "Desactivar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-3" variant="secondary" onClick={() => setEditing({ code: f.code, enabled: !f.enabled })}>
                  {f.enabled ? "Desactivar" : "Activar"}
                </Button>
              )}
            </div>
          ))}
          {data.history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Historial ({data.history.length})</summary>
              <ul className="mt-2 space-y-1">
                {data.history.map((h, i) => (
                  <li key={i} className="text-[var(--color-text-secondary)]">
                    {new Date(h.occurredAt).toLocaleString("es-PR")} · {LABELS[h.code].title} {h.enabled ? "activada" : "desactivada"} · {h.reason}{h.actorEmail ? ` · ${h.actorEmail}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
