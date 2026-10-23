import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "@/auth/token";
import { AdminPanel, AdminPanelHeader } from "@/components/admin/AdminUI";
import { listAgencyOpportunities, listPendingCounts, type AgencyOpportunity } from "@/api/smartmatch";
import { formatWindow } from "@/features/smartmatch/smartmatchText";
import { plural } from "./overviewModel";

interface Summary { pending: number; published: number; filled: number; awaiting: (AgencyOpportunity & { pending: number })[] }

/** SmartMatch en el resumen de la agencia (solo administradores). Sin datos de pacientes. */
export function SmartMatchPanel({ organizationId, className = "" }: { organizationId: string; className?: string }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let active = true;
    Promise.all([listAgencyOpportunities(organizationId, token), listPendingCounts(organizationId, token)])
      .then(([opps, counts]) => {
        if (!active) return;
        const byId = Object.fromEntries(counts.map((c) => [c.opportunity_id, c.pending_count]));
        const awaiting = opps
          .filter((o) => o.status === "PUBLISHED" && (byId[o.id] ?? 0) > 0)
          .map((o) => ({ ...o, pending: byId[o.id] ?? 0 }))
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setSummary({
          pending: counts.reduce((n, c) => n + c.pending_count, 0),
          published: opps.filter((o) => o.status === "PUBLISHED").length,
          filled: opps.filter((o) => o.status === "FILLED").length,
          awaiting,
        });
      })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [organizationId]);

  const stat = (label: string, value: number | string, highlight = false) => (
    <div className={`rounded-[10px] border p-3 ${highlight ? "border-[var(--color-accent-700)]/40 bg-[var(--color-accent-100)]/40" : "border-[var(--color-border)]"}`}>
      <p className="font-display text-2xl text-[var(--color-text-primary)]">{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );

  return (
    <AdminPanel className={`flex flex-col ${className}`}>
      <AdminPanelHeader title="SmartMatch"
        description={error ? "No se pudo cargar" : summary === null ? "Cargando…" : summary.pending
          ? plural(summary.pending, "solicitud pendiente", "solicitudes pendientes") : "Sin solicitudes pendientes"} />
      <div className="mx-5 mt-4 grid grid-cols-3 gap-2 sm:mx-6">
        {stat("Pendientes", summary?.pending ?? "–", (summary?.pending ?? 0) > 0)}
        {stat("Publicadas", summary?.published ?? "–")}
        {stat("Cubiertas", summary?.filled ?? "–")}
      </div>
      {summary && summary.awaiting.length > 0 && (
        <ul className="mx-5 mt-4 space-y-2 sm:mx-6" aria-label="Oportunidades con solicitudes">
          {summary.awaiting.slice(0, 3).map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => navigate(`/agency/smartmatch?opportunity=${o.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border)] p-3 text-left hover:border-[var(--color-text-primary)]/25">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">{o.role_label} · {o.region_label}</span>
                  <span className="block text-xs text-[var(--color-text-secondary)]">{formatWindow(o.starts_at, o.ends_at)}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[var(--color-accent-700)]">Revisar ({o.pending})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto p-5 sm:px-6">
        <button type="button" onClick={() => navigate("/agency/smartmatch")}
          className="min-h-11 w-full rounded-[10px] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-text-primary)]/25">
          Abrir SmartMatch
        </button>
      </div>
    </AdminPanel>
  );
}
