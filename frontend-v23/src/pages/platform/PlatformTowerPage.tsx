import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/auth/token";
import { apiClient } from "@/api/client";
import { buildTowerFloors } from "@/features/tower/floors";
import { TowerPremiumFacade } from "@/features/tower/TowerPremiumFacade";

type Health = "healthy" | "degraded" | "unavailable" | "unknown";
interface Agent { id: string; name: string; displayName?: string; mode: string; department?: string; responsibilities: readonly string[] }
interface Department { id: string; name: string }
interface PersistedTask { id: string; agentId: string; title: string; priority: string; status: string; createdAt: string }
interface TaskInboxResponse { mode: "read-only"; tasks: PersistedTask[] }
interface TaskAuditEvent { id: string; taskId: string; fromStatus: string; toStatus: string; actorId: string; occurredAt: string; reason: string | null }
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
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high">("normal");
  const [savingTask, setSavingTask] = useState(false);
  const [saveTaskMessage, setSaveTaskMessage] = useState("");
  const [taskInbox, setTaskInbox] = useState<PersistedTask[]>([]);
  const [taskInboxLoading, setTaskInboxLoading] = useState(false);
  const [taskInboxError, setTaskInboxError] = useState("");
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [auditTaskId, setAuditTaskId] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<TaskAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [taskInboxLoaded, setTaskInboxLoaded] = useState(false);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { setError("Inicia sesión para acceder a Tower."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setData(await apiClient.get<TowerOverview>("/platform/tower/overview", token)); }
    catch { setData(null); setError("No se pudo consultar ETNARA Tower. Verifica tu acceso o inténtalo de nuevo."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const loadTaskInbox = useCallback(async () => {
    const token = getToken();
    if (!token) { setTaskInboxError("Inicia sesión para consultar las tareas."); return; }
    setTaskInboxLoading(true); setTaskInboxError("");
    try {
      const response = await apiClient.get<TaskInboxResponse>("/platform/tower/tasks?limit=50", token);
      setTaskInbox(response.tasks);
      setTaskInboxLoaded(true);
    } catch {
      setTaskInboxError("No fue posible consultar las tareas guardadas. Comprueba que el backend y la migración estén disponibles.");
    } finally { setTaskInboxLoading(false); }
  }, []);
  const reviewTask = async (task: PersistedTask, nextStatus: string) => {
    const token = getToken();
    if (!token) { setReviewMessage("Inicia sesión nuevamente."); return; }
    setReviewBusyId(task.id); setReviewMessage("");
    try {
      await apiClient.post(`/platform/tower/tasks/${encodeURIComponent(task.id)}/review`, {
        expectedStatus: task.status, nextStatus,
      }, token);
      setReviewMessage("Decisión guardada con auditoría. Actualiza la bandeja para confirmar.");
      await loadTaskInbox();
    } catch {
      setReviewMessage("No se pudo registrar la decisión. Actualiza la bandeja y verifica el estado de la tarea.");
    } finally { setReviewBusyId(null); }
  };
  const showTaskAudit = async (taskId: string) => {
    if (auditTaskId === taskId) { setAuditTaskId(null); return; }
    setAuditTaskId(taskId); setAuditLoading(true); setAuditError(""); setAuditEvents([]);
    const token = getToken();
    if (!token) { setAuditError("Inicia sesión nuevamente."); setAuditLoading(false); return; }
    try {
      const result = await apiClient.get<{events: TaskAuditEvent[]}>(`/platform/tower/tasks/${encodeURIComponent(taskId)}/audit`, token);
      setAuditEvents(result.events);
    } catch { setAuditError("No se pudo cargar el historial de auditoría."); }
    finally { setAuditLoading(false); }
  };
  const departments = data?.departments ?? defaultDepartments;
  const roster = data?.corporateAgents ?? data?.agents ?? [];
  // Keep WebGL geometry stable while opening agent cards and changing directory filters.
  const towerFloors = useMemo(
    () => buildTowerFloors(departments, data?.corporateAgents ?? []),
    [data?.departments, data?.corporateAgents],
  );
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
    {data?.corporateAgents && <TowerPremiumFacade tasks={taskInbox} tasksLoaded={taskInboxLoaded} tasksLoading={taskInboxLoading} tasksError={taskInboxError} onRefreshTasks={() => void loadTaskInbox()} floors={towerFloors} onSelect={departmentId => { setSelected(departmentId); setSelectedAgentId(null); }} onSelectAgent={agentId => setSelectedAgentId(agentId)} onPrepareInstruction={agentId => { setSelectedAgentId(agentId); window.setTimeout(() => document.getElementById("tower-task-title")?.focus(), 0); }} />}
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
          <textarea id="tower-task-draft" value={draftInstruction} aria-label={`Borrador para ${selectedAgent.name}`} onChange={event => setDraftInstruction(event.target.value)} maxLength={1200} rows={3} placeholder="Ej.: Preparar una propuesta de calendario de publicaciones para ETNARA Care" className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm" />
          <p className="text-xs text-[var(--color-text-secondary)]">Borrador temporal en esta pantalla. No se guarda en el servidor, no se envía a ninguna IA y desaparece al recargar. No incluyas información confidencial.</p>
          <button type="submit" disabled={!draftInstruction.trim()} className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-5 text-sm font-semibold text-white disabled:opacity-50">Añadir a borradores</button>
        </form>
      </section>}
      {selectedAgent && <section aria-label="Guardar tarea en PostgreSQL" className="rounded-xl border border-[var(--color-border)] bg-white p-6">
        <h2 className="font-display text-2xl">Crear tarea para {selectedAgent.displayName ?? selectedAgent.name}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Se guardará como borrador en el servidor. No se envía a ninguna IA ni se ejecuta automáticamente.</p>
        <form className="mt-4 space-y-3" onSubmit={async event => {
          event.preventDefault();
          const token = getToken();
          if (!token) { setSaveTaskMessage("Inicia sesión nuevamente."); return; }
          setSavingTask(true); setSaveTaskMessage("");
          try {
            await apiClient.post("/platform/tower/tasks", {
              agentId: selectedAgent.id, title: taskTitle.trim(),
              instructions: draftInstruction.trim(), priority: taskPriority,
            }, token);
            setSaveTaskMessage("Borrador guardado en PostgreSQL. Consulta la bandeja para verlo.");
            setTaskTitle(""); setDraftInstruction("");
            setTaskInboxLoaded(false);
          } catch {
            setSaveTaskMessage("No se pudo guardar. Comprueba tu acceso y la disponibilidad de la base de datos.");
          } finally { setSavingTask(false); }
        }}>
          <label htmlFor="tower-persist-title" className="block text-sm font-semibold">Título de la tarea</label>
          <input id="tower-persist-title" required minLength={3} maxLength={120} value={taskTitle} onChange={event => setTaskTitle(event.target.value)} className="w-full rounded-lg border border-[var(--color-border)] p-3 text-sm" />
          <label htmlFor="tower-persist-priority" className="block text-sm font-semibold">Prioridad</label>
          <select id="tower-persist-priority" value={taskPriority} onChange={event => setTaskPriority(event.target.value as "low" | "normal" | "high")} className="w-full rounded-lg border border-[var(--color-border)] p-3 text-sm"><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select>
          <p className="text-sm text-[var(--color-text-secondary)]">Instrucciones: utiliza el campo «Preparar una instrucción» de la ficha del agente ({draftInstruction.trim().length}/1200 caracteres).</p>
          <button type="submit" disabled={savingTask || taskTitle.trim().length < 3 || draftInstruction.trim().length < 5} className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-5 text-sm font-semibold text-white disabled:opacity-50">{savingTask ? "Guardando…" : "Guardar borrador en servidor"}</button>
          {saveTaskMessage && <p role="status" className="text-sm">{saveTaskMessage}</p>}
        </form>
      </section>}
      <section aria-label="Centro de tareas corporativas" className="rounded-xl border border-[var(--color-border)] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">Administración · Tower</p><h2 className="mt-2 font-display text-2xl">Centro de tareas</h2></div>
          <button type="button" onClick={() => void loadTaskInbox()} disabled={taskInboxLoading} className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-5 text-sm font-semibold text-white disabled:opacity-50">{taskInboxLoading ? "Consultando…" : "Consultar tareas guardadas"}</button>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Bandeja real de PostgreSQL, disponible únicamente para administración de plataforma. Solo lectura: no asigna, aprueba ni ejecuta tareas.</p>
        {taskInboxError && <p role="alert" className="mt-3 rounded-lg border p-3 text-sm">{taskInboxError}</p>}
        {reviewMessage && <p role="status" className="mt-3 text-sm">{reviewMessage}</p>}
        {taskInboxLoaded && <div className="mt-4 space-y-3" aria-live="polite">
          {taskInbox.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">No hay tareas guardadas en el servidor.</p> : taskInbox.map(task => <article key={task.id} className="rounded-lg border border-[var(--color-border)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{task.title}</h3><span className="rounded-full border px-3 py-1 text-xs">{task.status}</span></div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{roster.find(agent => agent.id === task.agentId)?.displayName ?? task.agentId} · Prioridad: {task.priority}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Registrada: {new Date(task.createdAt).toLocaleString("es-PR")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(task.status === "draft" ? [{status:"submitted",label:"Enviar a revisión"}] :
                task.status === "submitted" ? [{status:"in_review",label:"Iniciar revisión"},{status:"rejected",label:"Rechazar"}] :
                task.status === "in_review" ? [{status:"approved",label:"Aprobar"},{status:"rejected",label:"Rechazar"}] : []
              ).map(action => <button key={action.status} type="button" disabled={reviewBusyId !== null}
                onClick={() => void reviewTask(task, action.status)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">{reviewBusyId === task.id ? "Guardando…" : action.label}</button>)}
              <button type="button" onClick={() => void showTaskAudit(task.id)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold"
                aria-expanded={auditTaskId === task.id}> {auditTaskId === task.id ? "Ocultar historial" : "Ver historial"} </button>
            </div>
            {auditTaskId === task.id && <div className="mt-3 rounded-lg border border-[var(--color-border)] p-3" aria-live="polite">
              <h4 className="font-semibold">Historial de decisiones</h4>
              {auditLoading ? <p className="text-sm">Cargando historial…</p> :
                auditError ? <p role="alert" className="text-sm">{auditError}</p> :
                auditEvents.length === 0 ? <p className="text-sm">Sin cambios de estado registrados.</p> :
                <ol className="mt-2 space-y-2">{auditEvents.map(event => <li key={event.id} className="text-sm">
                  <span className="font-semibold">{event.fromStatus} → {event.toStatus}</span>
                  <span className="block text-[var(--color-text-secondary)]">{new Date(event.occurredAt).toLocaleString("es-PR")} · Administrador: {event.actorId}</span>
                  {event.reason && <span className="block">{event.reason}</span>}
                </li>)}</ol>}
            </div>}
          </article>)}
        </div>}
        {!taskInboxLoaded && !taskInboxLoading && <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Pulsa «Consultar tareas guardadas» para cargar la bandeja desde el servidor.</p>}
      </section>
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
