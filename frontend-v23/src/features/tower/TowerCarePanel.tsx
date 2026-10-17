import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { useAuth } from "@/auth/AuthProvider";
import { listEstablishments, listEstablishmentShifts, type Establishment, type EstablishmentShift } from "@/api/establishments";
import { listIncidents, type Incident } from "@/api/incidents";

export function TowerCarePanel() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [shifts, setShifts] = useState<EstablishmentShift[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setEstablishments([]); setEstablishmentId(""); setShifts([]); setIncidents([]); setError("");
    const token = getToken();
    if (!organizationId || !token) return;
    let cancelled = false;
    void listEstablishments(organizationId, token).then(result => {
      if (!cancelled) setEstablishments(result.establishments.filter(e => e.status === "active"));
    }).catch(() => { if (!cancelled) setError("No se pudieron consultar los establecimientos autorizados."); });
    return () => { cancelled = true; };
  }, [organizationId]);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !establishmentId || !token) return;
    setLoading(true); setError(""); setShifts([]); setIncidents([]);
    try {
      const result = await listEstablishmentShifts(organizationId, establishmentId, token);
      setShifts(result.shifts);
    } catch { setError("No fue posible consultar los turnos de este establecimiento."); setLoading(false); return; }
    try {
      const rows = await listIncidents(organizationId, token);
      // Incidents are organization-scoped, not establishment-scoped.
      // Do not show them beside a selected establishment as if they belonged to it.
      setIncidents(rows);
    } catch { setError("Turnos disponibles; no fue posible consultar incidentes de la organización."); }
    finally { setLoading(false); }
  }, [organizationId, establishmentId]);
  const pending = incidents.filter(i => i.status !== "resolved");
  return <section aria-label="Tower Operaciones de Cuidado" className="rounded-xl border border-[var(--color-border)] bg-white p-5">
    <h2 className="font-display text-2xl">Operaciones de Cuidado · Consulta</h2>
    <p className="mt-2 text-sm">Datos reales en modo lectura. Los turnos pertenecen al establecimiento seleccionado; los incidentes se muestran únicamente como totales de la organización activa.</p>
    {!organizationId ? <p className="mt-3 text-sm">Selecciona una organización activa.</p> : <>
      <label htmlFor="tower-care-establishment" className="mt-4 block text-sm font-semibold">Establecimiento</label>
      <select id="tower-care-establishment" className="mt-2 min-h-11 w-full rounded-lg border p-2" value={establishmentId} onChange={e => { setEstablishmentId(e.target.value); setShifts([]); setIncidents([]); setError(""); }}>
        <option value="">Selecciona un establecimiento</option>
        {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <button type="button" disabled={!establishmentId || loading} onClick={() => void load()} className="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50">{loading ? "Consultando…" : "Consultar operaciones"}</button>
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><p className="text-2xl font-semibold">{shifts.length}</p><p className="text-xs">Turnos registrados · establecimiento</p></div>
        <div className="rounded-lg border p-3"><p className="text-2xl font-semibold">{pending.length}</p><p className="text-xs">Incidentes abiertos · organización</p></div>
        <div className="rounded-lg border p-3"><p className="text-2xl font-semibold">{incidents.length}</p><p className="text-xs">Incidentes totales · organización</p></div>
      </div>
      {shifts.length > 0 && <ul className="mt-4 space-y-2">{shifts.slice(0,20).map(s => <li key={s.id} className="rounded-lg border p-3 text-sm">{s.required_role} · {s.status} · {new Date(s.scheduled_start).toLocaleString("es-PR")}</li>)}</ul>}
    </>}
  </section>;
}
