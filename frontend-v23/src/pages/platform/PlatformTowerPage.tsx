import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/auth/token";
import { apiClient } from "@/api/client";
import { buildTowerFloors } from "@/features/tower/floors";
import { TowerPremiumFacade } from "@/features/tower/TowerPremiumFacade";

type Health = "healthy" | "degraded" | "unavailable" | "unknown";
interface Agent { id: string; name: string; displayName?: string; mode: string; department?: string; responsibilities: readonly string[] }
interface Department { id: string; name: string }
interface TowerOverview {
  mode: string;
  liveMonitoringEnabled: boolean;
  board: { overall: string; services: { service: string; health: Health; summary: string }[]; alerts: { title: string; service: string }[] };
  agents: Agent[];
  corporateAgents?: Agent[];
  departments?: Department[];
}
const labels: Record<string, string> = { backend: "Backend", frontend: "Portal web", database: "Base de datos", dns: "Dominio y DNS" };
const healthLabels: Record<Health, string> = { healthy: "Operativo", degraded: "Atención", unavailable: "No disponible", unknown: "Sin verificar" };
const defaultDepartments: Department[] = [
  { id: "executive", name: "Dirección Ejecutiva" },
  { id: "technology", name: "Tecnología e Ingeniería" },
  { id: "compliance", name: "Legal y Cumplimiento" },
  { id: "care", name: "Operaciones de Cuidado" },
  { id: "finance", name: "Finanzas y Crecimiento" },
  { id: "support", name: "Experiencia y Soporte" },
  { id: "secretariat", name: "Secretaría Ejecutiva" },
  { id: "marketing", name: "Mercadeo y Redes Sociales" },
];
export function PlatformTowerPage() {
  const [data, setData] = useState<TowerOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draftInstruction, setDraftInstruction] = useState("");
  const [drafts, setDrafts] = useState<{ id: number; agentId: string; agentName: string; instruction: string }[]>([]);
  const [nextDraftId, setNextDraftId] = useState(1);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setError("Inicia sesión para acceder a Tower."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setData(await apiClient.get<TowerOverview>("/platform/tower/overview", token)); }
    catch { setData(null); setError("No se pudo consultar ETNARA Tower. Verifica tu acceso o inténtalo de nuevo."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const departments = data?.departments ?? defaultDepartments;
  const roster = data?.corporateAgents ?? data?.agents ?? [];
  const filtered = useMemo(() => selected === "all" ? roster : roster.filter(agent => agent.department === selected), [roster, selected]);
  const selectedAgent = roster.find(agent => agent.id === selectedAgentId);
  const secretariat = roster.find(agent => agent.department === "secretariat" && agent.name.includes("Secretaria"));
  return <div className="space-y-6">
    <section className="rounded-[var(--radius-xl)] bg-[var(--color-navy-950)] p-6 text-white md:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sage-300)]">ETNARA · Oficina ejecutiva</p>
      <h1 className="mt-3 font-display text-4xl md:text-5xl">ETNARA Tower</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Tu sede corporativa digital: ocho departamentos, equipo virtual y supervisión de infraestructura. Acceso exclusivo de administración.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">Actualizar estados</button>
        {data?.corporateAgents && <span className="text-sm text-white/70">{data.corporateAgents.length} puestos virtuales · {departments.length} departamentos</span>}
      </div>
    </section>
    {data?.corporateAgents && <TowerPremiumFacade floors={buildTowerFloors(departments, data.corporateAgents)} onSelect={departmentId => { setSelected(departmentId); setSelectedAgentId(null); }} />}
    {loading && <p role="status">Consultando Tower…</p>}
    {error && <p role="alert" className="rounded-lg border border-[var(--color-border)] p-4">{error}</p>}
    {data && <>
      <p className="text-sm text-[var(--color-text-secondary)]">{data.liveMonitoringEnabled ? "Supervisión básica conectada · Los proveedores externos todavía pueden aparecer sin verificar." : "Vista preliminar · Supervisión automática todavía no activada."}</p>
      <section aria-label="Servicios supervisados" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.board.services.map(service => <article key={service.service} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">{labels[service.service] ?? service.service}</p>
          <h2 className="mt-2 font-display text-2xl">{healthLabels[service.health]}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{service.summary}</p>
        </article>)}
      </section>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Oficina ejecutiva">
        <article className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">Tu oficina</p>
          <h2 className="mt-2 font-display text-2xl">Despacho ejecutivo</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Visión general de los equipos y departamentos de ETNARA. Las acciones sensibles requerirán autorización expresa.</p>
        </article>
        <article className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">Secretaría ejecutiva</p>
          <h2 className="mt-2 font-display text-2xl">{secretariat?.displayName ? `${secretariat.displayName} — ${secretariat.name}` : "NORA — Secretaria Ejecutiva Virtual"}</h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Puesto en planificación para coordinar agenda, correspondencia y tareas entre departamentos. Todavía no recibe instrucciones ni envía mensajes.</p>
        </article>
      </section>
      <section aria-label="Departamentos Tower">
        <h2 className="font-display text-3xl">Departamentos</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Selecciona un departamento para explorar su personal virtual.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={selected === "all"} onClick={() => setSelected("all")} className={`min-h-11 rounded-full border px-4 text-sm ${selected === "all" ? "bg-[var(--color-navy-950)] text-white" : "bg-white"}`}>Todos</button>
          {departments.map(dept => <button key={dept.id} type="button" aria-pressed={selected === dept.id} onClick={() => setSelected(dept.id)} className={`min-h-11 rounded-full border px-4 text-sm ${selected === dept.id ? "bg-[var(--color-navy-950)] text-white" : "bg-white"}`}>{dept.name}</button>)}
        </div>
      </section>
      {selectedAgent && <section aria-label="Ficha del agente" className="rounded-xl border border-[var(--color-border)] bg-white p-6" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">Ficha de personal virtual</p><h2 className="mt-2 font-display text-3xl">{selectedAgent.displayName ? `${selectedAgent.displayName} — ` : ""}{selectedAgent.name}</h2></div><button type="button" onClick={() => setSelectedAgentId(null)} className="min-h-11 rounded-lg border px-4 text-sm">Cerrar ficha</button></div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Departamento: {departments.find(d => d.id === selectedAgent.department)?.name ?? "Tecnología e Ingeniería"}</p>
        <h3 className="mt-5 font-semibold">Responsabilidades propuestas</h3><ul className="mt-2 list-inside list-disc text-sm text-[var(--color-text-secondary)]">{selectedAgent.responsibilities.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="mt-5 rounded-lg bg-[var(--color-navy-950)] p-4 text-sm text-white">Estado: en planificación. Este puesto todavía no ejecuta instrucciones ni accede a servicios externos.</p>
        <form className="mt-5 space-y-3" onSubmit={event => { event.preventDefault(); const instruction = draftInstruction.trim(); if (!instruction || !selectedAgent) return; setDrafts(current => [...current, { id: nextDraftId, agentId: selectedAgent.id, agentName: selectedAgent.name, instruction }]); setNextDraftId(id => id + 1); setDraftInstruction(""); }}>
          <label htmlFor="tower-task-draft" className="block text-sm font-semibold">Preparar una instrucción para este puesto</label>
          <textarea id="tower-task-draft" value={draftInstruction} onChange={event => setDraftInstruction(event.target.value)} maxLength={1200} rows={3} placeholder="Ej.: Preparar una propuesta de calendario de publicaciones para ETNARA Care" className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm" />
          <p className="text-xs text-[var(--color-text-secondary)]">Borrador temporal en esta pantalla. No se guarda en el servidor, no se envía a ninguna IA y desaparece al recargar. No incluyas información confidencial.</p>
          <button type="submit" disabled={!draftInstruction.trim()} className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-5 text-sm font-semibold text-white disabled:opacity-50">Añadir a borradores</button>
        </form>
      </section>}
      <section aria-label="Borradores de instrucciones" className="rounded-xl border border-[var(--color-border)] bg-white p-6">
        <h2 className="font-display text-2xl">Borradores de instrucciones ({drafts.length})</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Planificación local únicamente: estas instrucciones no se han asignado ni ejecutado.</p>
        <div className="mt-4 space-y-3">{drafts.map(draft => <article key={draft.id} className="rounded-lg border border-[var(--color-border)] p-4"><p className="text-sm font-semibold">{draft.agentName}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{draft.instruction}</p><button type="button" onClick={() => setDrafts(current => current.filter(item => item.id !== draft.id))} className="mt-3 min-h-11 rounded-lg border px-4 text-sm">Eliminar borrador</button></article>)}{drafts.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">Todavía no has preparado instrucciones.</p>}</div>
      </section>
      <section aria-label="Personal virtual">
        <h2 className="font-display text-3xl">Equipo Tower</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Roles virtuales en planificación. No ejecutan cambios, publican contenido ni acceden a expedientes.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(agent => <article key={agent.id} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">{departments.find(d => d.id === agent.department)?.name ?? "Tecnología"}</p>
            <h3 className="mt-2 font-display text-xl">{agent.displayName ? `${agent.displayName} — ` : ""}{agent.name}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{agent.responsibilities.join(" · ")}</p>
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">En planificación · Sin ejecución autónoma</p>
            <button type="button" onClick={() => setSelectedAgentId(agent.id)} aria-label={`Ver ficha de ${agent.name}`} className="mt-4 min-h-11 rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-sage-100)]">Ver ficha</button>
          </article>)}
          {filtered.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">Este departamento estará disponible cuando se publique el nuevo catálogo.</p>}
        </div>
      </section>
    </>}
  </div>;
}
