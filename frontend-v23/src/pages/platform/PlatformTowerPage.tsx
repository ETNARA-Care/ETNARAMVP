import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/auth/token";
import { apiClient } from "@/api/client";

type Health = "healthy" | "degraded" | "unavailable" | "unknown";
interface TowerOverview {
  mode: string;
  liveMonitoringEnabled: boolean;
  board: { overall: string; services: { service: string; health: Health; summary: string }[]; alerts: { title: string; service: string }[] };
  agents: { id: string; name: string; responsibilities: string[]; mode: string }[];
}
const labels: Record<string, string> = { backend: "Backend", frontend: "Portal web", database: "Base de datos", dns: "Dominio y DNS" };
const healthLabels: Record<Health, string> = { healthy: "Operativo", degraded: "Atención", unavailable: "No disponible", unknown: "Sin verificar" };

export function PlatformTowerPage() {
  const [data, setData] = useState<TowerOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setError("Inicia sesión para acceder a Tower."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setData(await apiClient.get<TowerOverview>("/platform/tower/overview", token)); }
    catch { setData(null); setError("No se pudo consultar ETNARA Tower. Verifica tu acceso o inténtalo de nuevo."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-6">
    <section className="rounded-[var(--radius-xl)] bg-[var(--color-navy-950)] p-6 text-white md:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sage-300)]">ETNARA · Centro de operaciones</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">ETNARA Tower</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Infraestructura y equipo técnico de ETNARA. Panel exclusivo para administración de plataforma.</p>
      <button type="button" onClick={() => void load()} disabled={loading} className="mt-5 min-h-11 rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">Actualizar estados</button>
    </section>
    {loading && <p role="status">Consultando Tower…</p>}
    {error && <p role="alert" className="rounded-lg border border-[var(--color-border)] p-4">{error}</p>}
    {data && <>
      <p className="text-sm text-[var(--color-text-secondary)]">{data.liveMonitoringEnabled ? "Supervisión conectada" : "Vista preliminar · Supervisión automática todavía no activada. Los estados desconocidos no indican que haya una falla."}</p>
      <section aria-label="Servicios supervisados" className="grid gap-4 sm:grid-cols-2">
        {data.board.services.map(service => <article key={service.service} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">{labels[service.service] ?? service.service}</p>
          <h2 className="mt-2 font-display text-2xl">{healthLabels[service.health]}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{service.summary}</p>
        </article>)}
      </section>
      <section><h2 className="font-display text-3xl">Equipo Tower</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Agentes en planificación. No ejecutan cambios en producción.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.agents.map(agent => <article key={agent.id} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
          <h3 className="font-display text-xl">{agent.name}</h3><p className="mt-2 text-sm text-[var(--color-text-secondary)]">{agent.responsibilities.join(" · ")}</p>
        </article>)}</div>
      </section>
    </>}
  </div>;
}
