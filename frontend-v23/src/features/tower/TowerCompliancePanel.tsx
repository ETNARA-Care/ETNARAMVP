import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { useAuth } from "@/auth/AuthProvider";
import { apiClient } from "@/api/client";
import { listEstablishments, type Establishment } from "@/api/establishments";

interface DocumentSummary { id: string; title: string; document_type: string; expires_on: string | null; review_status: string }
type Category = "expired" | "soon" | "valid" | "noDate";
function category(expires: string | null): Category {
  if (!expires) return "noDate";
  const day = expires.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (day < today) return "expired";
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  return day <= cutoff.toISOString().slice(0, 10) ? "soon" : "valid";
}
export function TowerCompliancePanel() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState("");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setEstablishments([]); setEstablishmentId(""); setDocuments([]); setError("");
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
    setLoading(true); setError(""); setDocuments([]);
    try {
      const result = await apiClient.get<{ documents: DocumentSummary[] }>(
        `/organizations/${encodeURIComponent(organizationId)}/establishments/${encodeURIComponent(establishmentId)}/documents`, token);
      setDocuments(result.documents);
    } catch { setError("No se pudo consultar el expediente. Verifica tus permisos para este establecimiento."); }
    finally { setLoading(false); }
  }, [organizationId, establishmentId]);
  const counts = { expired: 0, soon: 0, valid: 0, noDate: 0 };
  documents.forEach(doc => { counts[category(doc.expires_on)]++; });
  return <section aria-label="Tower Compliance: documentos del establecimiento" className="rounded-xl border border-[var(--color-border)] bg-white p-5">
    <h2 className="font-display text-2xl">Cumplimiento · Consulta documental</h2>
    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Consulta de solo lectura por organización y establecimiento. La vigencia se calcula por fecha; no equivale a aprobación regulatoria.</p>
    {!organizationId ? <p className="mt-3 text-sm">Selecciona una organización activa para consultar sus establecimientos.</p> : <>
      <label htmlFor="tower-compliance-establishment" className="mt-4 block text-sm font-semibold">Establecimiento</label>
      <select id="tower-compliance-establishment" className="mt-2 min-h-11 w-full rounded-lg border border-[var(--color-border)] p-2" value={establishmentId} onChange={event => { setEstablishmentId(event.target.value); setDocuments([]); setError(""); }}>
        <option value="">Selecciona un establecimiento</option>
        {establishments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button type="button" disabled={!establishmentId || loading} onClick={() => void load()} className="mt-3 min-h-11 rounded-lg bg-[var(--color-navy-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Consultando…" : "Consultar documentos"}</button>
      {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{([["Vencidos",counts.expired],["Próximos 30 días",counts.soon],["Vigentes por fecha",counts.valid],["Sin vencimiento",counts.noDate]] as const).map(([label,count]) => <div key={label} className="rounded-lg border border-[var(--color-border)] p-3"><p className="text-2xl font-semibold">{count}</p><p className="text-xs">{label}</p></div>)}</div>
      {documents.length > 0 && <ul className="mt-4 space-y-2">{documents.map(doc => <li key={doc.id} className="rounded-lg border border-[var(--color-border)] p-3 text-sm"><strong>{doc.title}</strong><span className="block text-xs">{doc.document_type} · Revisión: {doc.review_status} · Vence: {doc.expires_on?.slice(0,10) ?? "No registrado"}</span></li>)}</ul>}
    </>}
  </section>;
}
