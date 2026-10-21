import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../api/client";
import {
  createSmartMatchDraft, listSmartMatchOpportunities, listSmartMatchApplicationCounts, publishSmartMatchDraft,
  type SmartMatchOpportunity, type SmartMatchApplicationCount,
} from "../../api/smartmatch";

export function AgencySmartMatchPage() {
  const { activeOrganization } = useAuth();
  return <AgencySmartMatchForOrganization key={activeOrganization?.id ?? "none"} />;
}

function AgencySmartMatchForOrganization() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const isAdmin = activeOrganization?.roles.includes("ORGANIZATION_ADMIN") ?? false;
  const [items, setItems] = useState<SmartMatchOpportunity[]>([]);
  const [counts, setCounts] = useState<SmartMatchApplicationCount[]>([]);
  const [countsError, setCountsError] = useState(false);
  const [regionLabel, setRegionLabel] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    if (!organizationId || !isAdmin) { setItems([]); setCounts([]); return; }
    setItems([]); setCounts([]); setCountsError(false);
    void listSmartMatchApplicationCounts(organizationId).then(response => {
      if (active) setCounts(response.counts);
    }).catch(() => { if (active) setCountsError(true); });
    void listSmartMatchOpportunities(organizationId).then(response => {
      if (active) { setItems(response.opportunities); setError(""); }
    }).catch(err => {
      if (active) setError(err instanceof ApiError && err.status === 403
        ? "No tienes autorización para consultar SmartMatch."
        : "No se pudo cargar SmartMatch. Comprueba que el backend de pruebas esté actualizado.");
    });
    return () => { active = false; };
  }, [organizationId, isAdmin, requestVersion]);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await createSmartMatchDraft(organizationId, {
        regionLabel, roleLabel,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setNotice("Borrador guardado en la agencia.");
      setRequestVersion(version => version + 1);
    } catch {
      setError("No se pudo guardar el borrador. Verifica las fechas y los permisos.");
    } finally { setLoading(false); }
  }

  async function publish(id: string) {
    if (!organizationId) return;
    setLoading(true); setError(""); setNotice("");
    try {
      await publishSmartMatchDraft(organizationId, id);
      setNotice("Oportunidad interna publicada.");
      setRequestVersion(version => version + 1);
    } catch {
      setError("No se pudo publicar. Solo el creador puede publicar un borrador futuro.");
    } finally { setLoading(false); }
  }

  if (!organizationId || !isAdmin) return <main style={{ padding: 24 }}>SmartMatch requiere acceso de administrador de agencia.</main>;
  return (
    <main style={{ maxWidth: 850, margin: "0 auto", padding: 24 }}>
      <h1>SmartMatch · Bolsa interna</h1>
      <p>{activeOrganization?.name} · Pruebas de agencias. La red entre agencias está deshabilitada.</p>
      <p>Los borradores solo contienen zona general, función y horario. No incluyas nombres de pacientes ni direcciones exactas.</p>
      {error && <p role="alert" style={{ color: "var(--color-danger, #a12b2b)" }}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={createDraft} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <label>Municipio o zona general<input required maxLength={100} value={regionLabel} onChange={e => setRegionLabel(e.target.value)} /></label>
        <label>Función requerida<input required maxLength={100} value={roleLabel} onChange={e => setRoleLabel(e.target.value)} /></label>
        <label>Inicio<input required type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
        <label>Fin<input required type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></label>
        <button disabled={loading} type="submit">Guardar borrador</button>
      </form>
      <h2>Oportunidades de esta agencia</h2>
      <button disabled={loading} type="button" onClick={() => setRequestVersion(version => version + 1)}>Actualizar</button>
      {countsError && <p role="status">No se pudieron cargar los conteos de solicitudes.</p>}
      {items.length === 0 && <p>No hay oportunidades registradas.</p>}
      <ul>
        {items.map(item => (
          <li key={item.id} style={{ marginTop: 16 }}>
            <strong>{item.role_label}</strong> · {item.region_label} · {item.status}
            <div>Solicitudes pendientes: {countsError ? "No disponible" : (counts.find(count => count.opportunity_id === item.id)?.pending_count ?? 0)}</div>
            <div>{new Date(item.starts_at).toLocaleString("es-PR")} — {new Date(item.ends_at).toLocaleString("es-PR")}</div>
            {item.status === "DRAFT" && (
              <button disabled={loading} type="button" onClick={() => void publish(item.id)}>Publicar internamente</button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
