import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { listCaregiverSmartMatchOpportunities, type CaregiverSmartMatchOpportunity } from "../../api/smartmatch";
import { puertoRicoMunicipalities } from "../../data/puertoRicoMunicipalities";

export function CaregiverSmartMatchPage() {
  const { activeOrganization } = useAuth();
  return <CaregiverSmartMatchOrganization key={activeOrganization?.id ?? "none"} />;
}

function CaregiverSmartMatchOrganization() {
  const { activeOrganization } = useAuth();
  const orgId = activeOrganization?.id;
  const isCaregiver = activeOrganization?.roles.includes("CAREGIVER") ?? false;
  const [municipality, setMunicipality] = useState<string>("");
  const [items, setItems] = useState<CaregiverSmartMatchOpportunity[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    if (!orgId || !isCaregiver) { setStatus("ready"); setItems([]); return; }
    let active = true;
    setStatus("loading"); setItems([]);
    void listCaregiverSmartMatchOpportunities(orgId).then(data => {
      if (active) { setItems(data.opportunities); setStatus("ready"); }
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [orgId, isCaregiver]);
  if (!orgId || !isCaregiver) return <main style={{ padding: 24 }}>SmartMatch requiere acceso de cuidador de una agencia activa.</main>;
  const shown = items.filter(item => !municipality || item.region_label === municipality);
  return <main style={{ maxWidth: 780, margin: "0 auto", padding: 24 }}>
    <h1>SmartMatch · Oportunidades internas</h1>
    <p>Solo oportunidades publicadas por tu agencia. No se comparten datos de pacientes ni direcciones exactas.</p>
    <label style={{ display: "grid", gap: 8, maxWidth: 360 }}>Filtrar por municipio
      <select value={municipality} onChange={e => setMunicipality(e.target.value)}>
        <option value="">Todos los municipios</option>
        {puertoRicoMunicipalities.map(town => <option key={town} value={town}>{town}</option>)}
      </select>
    </label>
    <p>La verificación de credenciales, disponibilidad y tiempo real de viaje todavía no está habilitada. Estos resultados no constituyen una oferta de asignación.</p>
    {status === "loading" && <p role="status">Cargando oportunidades…</p>}
    {status === "error" && <p role="alert">No se pudieron cargar las oportunidades. El entorno de pruebas podría no estar listo.</p>}
    {status === "ready" && shown.length === 0 && <p>No hay oportunidades publicadas para este filtro.</p>}
    {status === "ready" && <ul>{shown.map(item => <li key={item.id} style={{ marginBottom: 18 }}>
      <strong>{item.role_label}</strong> · {item.region_label}
      <div>{new Date(item.starts_at).toLocaleString("es-PR")} — {new Date(item.ends_at).toLocaleString("es-PR")}</div>
      <small>Solicitudes y asignaciones aún no disponibles.</small>
    </li>)}</ul>}
  </main>;
}
