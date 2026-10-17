import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/auth/token";
import { apiClient } from "@/api/client";
import { buildTowerFloors } from "@/features/tower/floors";
import { TowerPremiumFacade } from "@/features/tower/TowerPremiumFacade";
import { TowerCompliancePanel } from "@/features/tower/TowerCompliancePanel";
import { TowerCarePanel } from "@/features/tower/TowerCarePanel";
import { TowerExecutiveSummary } from "@/features/tower/TowerExecutiveSummary";
import { TowerBusinessDepartments } from "@/features/tower/TowerBusinessDepartments";

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
  const [repairSignal, setRepairSignal] = useState("frontend_unavailable");
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairError, setRepairError] = useState("");
  const [repairPlan, setRepairPlan] = useState<{
    signal: string; diagnosis: string; suggestedChecks: string[]; suggestedFiles: string[];
    nextStep: string; pullRequestCreated: false; changesApplied: false;
  } | null>(null);
  const requestRepairPlan = async () => {
    const token = getToken();
    if (!token) { setRepairError("Inicia sesión nuevamente."); return; }
    setRepairLoading(true); setRepairError(""); setRepairPlan(null);
    try {
      const result = await apiClient.post<{ plan: NonNullable<typeof repairPlan> }>(
        "/platform/tower/pilot/repair-plan",
        { agentId: "technology-2", signal: repairSignal }, token);
      setRepairPlan(result.plan);
    } catch {
      setRepairError("No fue posible obtener el plan. Verifica que el backend esté actualizado.");
    } finally { setRepairLoading(false); }
  };
  const [repairRepository, setRepairRepository] = useState("ETNARA-Care/ETNARA-Backend");
  const [repairBranch, setRepairBranch] = useState("repair/tower-health-check");
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState("");
  const [preflightPassed, setPreflightPassed] = useState(false);
  const runRepairPrPreflight = async () => {
    const token = getToken();
    if (!token) { setPreflightError("Inicia sesión nuevamente."); return; }
    setPreflightLoading(true); setPreflightError(""); setPreflightPassed(false);
    try {
      const result = await apiClient.post<{ mode: string; githubWriteEnabled: boolean }>(
        "/platform/tower/pilot/repair-pr-preflight",
        { agentId: "technology-2", signal: repairSignal, repository: repairRepository, branch: repairBranch }, token);
      setPreflightPassed(result.mode === "dry-run" && result.githubWriteEnabled === false);
    } catch {
      setPreflightError("La validación no fue aceptada o el backend no está actualizado.");
    } finally { setPreflightLoading(false); }
  };
  const [versionPath, setVersionPath] = useState("src/modules/etnaraTower/liveHealthCollector.ts");
  const [expectedBlobSha, setExpectedBlobSha] = useState("");
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionStatus, setVersionStatus] = useState("");
  const verifyGithubVersion = async () => {
    const token = getToken();
    if (!token) { setVersionStatus("Inicia sesión nuevamente."); return; }
    if (!/^[a-f0-9]{40}$/.test(expectedBlobSha)) {
      setVersionStatus("Ingresa el SHA de 40 caracteres hexadecimales en minúsculas."); return;
    }
    setVersionLoading(true); setVersionStatus("");
    try {
      const result = await apiClient.post<{ status: string; currentGithubVersionVerified: boolean; githubWriteEnabled: boolean }>(
        "/platform/tower/pilot/live-repair-version-preflight",
        { agentId: "technology-2", signal: repairSignal, repository: repairRepository, branch: repairBranch,
          files: [{ path: versionPath, expectedBlobSha }] }, token);
      setVersionStatus(result.status === "match" && result.currentGithubVersionVerified && !result.githubWriteEnabled
        ? "Versión verificada en GitHub. No se ha modificado código ni autorizado una reparación."
        : "No se pudo confirmar la versión; no se permite continuar.");
    } catch {
      setVersionStatus("Verificación no disponible, versión desactualizada o solicitud rechazada. No se realizaron cambios.");
    } finally { setVersionLoading(false); }
  };
  const [pilotLoading, setPilotLoading] = useState(false);
  const [pilotError, setPilotError] = useState("");
  const [pilotResult, setPilotResult] = useState<{ agentId: string; checkedAt: string; board: TowerOverview["board"] } | null>(null);
  const runHealthPilot = async (agentId: string) => {
    const token = getToken();
    if (!token) { setPilotError("Inicia sesión nuevamente."); return; }
    setPilotLoading(true); setPilotError(""); setPilotResult(null);
    try {
      const result = await apiClient.get<{ agentId: string; checkedAt: string; board: TowerOverview["board"] }>(
        `/platform/tower/pilot/health/${encodeURIComponent(agentId)}`, token);
      setPilotResult(result);
    } catch {
      setPilotError("No fue posible consultar el diagnóstico. Verifica el despliegue del backend e inténtalo nuevamente.");
    } finally { setPilotLoading(false); }
  };
  const saveAgentDeskTask = async (agentId: string, title: string, instructions: string, priority: "low"|"normal"|"high"): Promise<string> => {
    const token=getToken();
    if(!token)return "Inicia sesión nuevamente para guardar la tarea.";
    try {
      await apiClient.post("/platform/tower/tasks",{agentId,title,instructions,priority},token);
      await loadTaskInbox();
      return "Borrador guardado en PostgreSQL para revisión administrativa. No se ejecutó ninguna instrucción.";
    } catch {return "No se pudo guardar la tarea. Comprueba tu acceso y el estado del servidor.";}
  };
  const handleAgentMessage = async (agentId: string, message: string): Promise<string> => {
    if (message.length > 1000) return "El mensaje excede el límite permitido.";
    if (agentId !== "technology-3" && agentId !== "technology-4") {
      return "Este puesto todavía no tiene un modelo conversacional conectado. Puedo ayudarte a preparar una tarea administrativa, pero no ejecutar instrucciones.";
    }
    const token = getToken();
    if (!token) return "Tu sesión ha expirado. Inicia sesión nuevamente.";
    try {
      const result = await apiClient.get<{agentId:string;checkedAt:string;board:TowerOverview["board"]}>(`/platform/tower/pilot/health/${encodeURIComponent(agentId)}`, token);
      const services = result.board.services;
      const unknown = services.filter(service => service.health === "unknown");
      const problematic = services.filter(service => service.health === "degraded" || service.health === "unavailable");
      const question = message.toLocaleLowerCase("es");
      const wantsDns = /dns|dominio|cloudflare/.test(question);
      const wantsProblems = /problema|error|falla|riesgo|alerta|preocup|unknown|desconocid|por qu[eé]|qué pasa/.test(question);
      const wantsDatabase = /base de datos|postgres|database/.test(question);
      const wantsBackend = /backend|api|servidor/.test(question);
      const wantsFrontend = /frontend|portal|página|web/.test(question);
      const focused = wantsDns ? services.filter(service => service.service === "dns") :
        wantsDatabase ? services.filter(service => service.service === "database") :
        wantsBackend ? services.filter(service => service.service === "backend") :
        wantsFrontend ? services.filter(service => service.service === "frontend") : services;
      const summary = focused.map(service => `${labels[service.service] ?? service.service}: ${healthLabels[service.health]} — ${service.summary}`).join("\n");
      const note = wantsDns ? "No tengo observaciones DNS disponibles. Esto no demuestra una falla; hace falta integrar una comprobación DNS para verificarlo." :
        wantsProblems ? (problematic.length ? "Hay servicios con señales de degradación o indisponibilidad. Recomiendo revisar sus registros antes de proponer cambios." : unknown.length ? "No detecté fallos en los servicios comprobados, pero faltan observaciones para algunos componentes; por eso el estado general puede ser desconocido." : "Los servicios comprobados no reportaron fallos en esta consulta.") :
        "Puedo consultar el estado de los servicios, pero aún no puedo investigar registros ni ejecutar reparaciones.";
      return `AXEL / ORION · Diagnóstico de solo lectura (${new Date(result.checkedAt).toLocaleString("es-PR")})\n\n${summary}\n\n${note}\n\n¿Quieres revisar un servicio concreto (backend, portal web, base de datos o DNS)?\n\nRespuesta guiada por reglas y datos reales; todavía no es IA conversacional. No se realizaron cambios.`;
    } catch {
      return "No pude completar el diagnóstico. No se realizaron cambios. Comprueba tu sesión y el servicio de ETNARA Tower.";
    }
  };
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
  useEffect(() => { void loadTaskInbox(); }, [loadTaskInbox]);
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
      if (auditTaskId === task.id) {
        const updatedAudit = await apiClient.get<{events: TaskAuditEvent[]}>(`/platform/tower/tasks/${encodeURIComponent(task.id)}/audit`, token);
        setAuditEvents(updatedAudit.events);
      }
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
  return <div className="min-w-0 space-y-6">
    <section className="grid w-full min-w-0 grid-cols-1 rounded-[var(--radius-xl)] bg-[var(--color-navy-950)] p-5 text-white sm:p-6 md:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sage-300)]">ETNARA · Oficina ejecutiva</p>
      <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl md:text-5xl">ETNARA Tower</h1>
      <p className="mt-3 block w-full min-w-0 max-w-[42rem] text-sm leading-6 text-white/70 ">Tu sede corporativa digital: ocho departamentos, equipo virtual y supervisión de infraestructura. Acceso exclusivo de administración.</p>
      <div className="mt-5 flex min-w-0 flex-wrap items-center gap-3">
        <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-lg border border-white/30 px-5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">Actualizar estados</button>
        {data?.corporateAgents && <span className="text-sm text-white/70">{data.corporateAgents.length} puestos virtuales · {departments.length} departamentos</span>}
      </div>
    </section>
    {data?.corporateAgents && <TowerPremiumFacade onSaveAgentTask={saveAgentDeskTask} onAgentMessage={handleAgentMessage} tasks={taskInbox} tasksLoaded={taskInboxLoaded} tasksLoading={taskInboxLoading} tasksError={taskInboxError} onRefreshTasks={() => void loadTaskInbox()} floors={towerFloors} onSelect={departmentId => { setSelected(departmentId); setSelectedAgentId(null); }} onSelectAgent={agentId => setSelectedAgentId(agentId)} onPrepareInstruction={agentId => { setSelectedAgentId(agentId); window.setTimeout(() => document.getElementById("tower-persist-title")?.focus(), 0); }} />}
    <TowerCompliancePanel />
    <TowerCarePanel />
    <TowerBusinessDepartments tasks={taskInbox} agents={data?.corporateAgents ?? data?.agents ?? []} loaded={taskInboxLoaded} />
    <TowerExecutiveSummary tasks={taskInbox} agents={data?.corporateAgents ?? data?.agents ?? []} loaded={taskInboxLoaded} loading={taskInboxLoading} onRefresh={() => { void loadTaskInbox(); }} />
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
        <p className="mt-5 rounded-lg bg-[var(--color-navy-950)] p-4 text-sm text-white">{["technology-3", "technology-4"].includes(selectedAgent.id) ? "Piloto disponible: consulta manual de estado de servicios, sin cambios ni ejecución autónoma." : "Estado: en planificación. Este puesto todavía no ejecuta instrucciones ni accede a servicios externos."}</p>
        {["technology-3", "technology-4"].includes(selectedAgent.id) && <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="font-semibold">Diagnóstico de infraestructura · Solo lectura</h3>
          <button type="button" disabled={pilotLoading} onClick={() => void runHealthPilot(selectedAgent.id)}
            className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {pilotLoading ? "Consultando…" : "Ejecutar diagnóstico"}
          </button>
          {pilotError && <p role="alert" className="text-sm">{pilotError}</p>}
          {pilotResult?.agentId === selectedAgent.id && <div role="status" className="space-y-2 text-sm">
            <p>Consulta realizada: {new Date(pilotResult.checkedAt).toLocaleString("es-PR")}</p>
            <p>Estado general: {pilotResult.board.overall}</p>
            <ul className="space-y-2">{pilotResult.board.services.map(service => <li key={service.service} className="rounded-lg border p-3">
              <strong>{labels[service.service] ?? service.service}: {healthLabels[service.health]}</strong>
              <p className="mt-1 text-[var(--color-text-secondary)]">{service.summary}</p>
            </li>)}</ul>
          </div>}
        </div>}
        {selectedAgent.id === "technology-2" && <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="font-semibold">LEO · Planificador de reparaciones</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">Selecciona un problema conocido para obtener un plan técnico. No modifica código ni crea PR automáticamente.</p>
          <label htmlFor="tower-repair-signal" className="block text-sm font-semibold">Problema a investigar</label>
          <select id="tower-repair-signal" value={repairSignal} onChange={event => setRepairSignal(event.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm">
            <option value="frontend_unavailable">Portal web no disponible</option>
            <option value="database_unavailable">Base de datos no disponible</option>
            <option value="backend_degraded">Backend degradado</option>
          </select>
          <button type="button" disabled={repairLoading} onClick={() => void requestRepairPlan()}
            className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {repairLoading ? "Preparando…" : "Preparar plan de reparación"}
          </button>
          <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
            <h4 className="font-semibold">Validar borrador de PR · Sin escritura</h4>
            <label htmlFor="tower-repair-repository" className="block text-sm">Repositorio</label>
            <select id="tower-repair-repository" value={repairRepository} onChange={event => { setRepairRepository(event.target.value); setVersionPath(event.target.value === "ETNARA-Care/ETNARA-Backend" ? "src/modules/etnaraTower/liveHealthCollector.ts" : "frontend-v23/src/pages/platform/PlatformTowerPage.tsx"); setExpectedBlobSha(""); setVersionStatus(""); setPreflightPassed(false); }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm">
              <option value="ETNARA-Care/ETNARA-Backend">ETNARA Backend</option>
              <option value="ETNARA-Care/ETNARAMVP">ETNARA Frontend</option>
            </select>
            <label htmlFor="tower-repair-branch" className="block text-sm">Rama propuesta (repair/...)</label>
            <input id="tower-repair-branch" value={repairBranch} onChange={event => { setRepairBranch(event.target.value); setPreflightPassed(false); }}
              maxLength={56} className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm" />
            <button type="button" disabled={preflightLoading} onClick={() => void runRepairPrPreflight()}
              className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">
              {preflightLoading ? "Validando…" : "Validar propuesta"}
            </button>
            {preflightError && <p role="alert" className="text-sm">{preflightError}</p>}
            {preflightPassed && <p role="status" className="text-sm font-semibold">Validación preliminar aceptada. No se creó ninguna rama, PR ni modificación de código. Se requiere aprobación administrativa.</p>}
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
            <h4 className="font-semibold">LEO · Verificar versión real en GitHub</h4>
            <p className="text-sm">Solo lectura. Requiere credencial de GitHub configurada en el servidor y acceso administrativo.</p>
            <label htmlFor="tower-version-path" className="block text-sm">Archivo permitido</label>
            <select id="tower-version-path" value={versionPath} onChange={event => { setVersionPath(event.target.value); setVersionStatus(""); }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm">
              {repairRepository === "ETNARA-Care/ETNARA-Backend" ? <>
                <option value="src/modules/etnaraTower/liveHealthCollector.ts">Diagnóstico del backend</option>
                <option value="src/modules/etnaraTower/tower.routes.ts">Rutas de Tower</option>
              </> : <option value="frontend-v23/src/pages/platform/PlatformTowerPage.tsx">Panel ETNARA Tower</option>}
            </select>
            <label htmlFor="tower-version-sha" className="block text-sm">SHA esperado del archivo (40 caracteres)</label>
            <input id="tower-version-sha" value={expectedBlobSha} onChange={event => { setExpectedBlobSha(event.target.value.trim()); setVersionStatus(""); }}
              placeholder="SHA del archivo en GitHub" maxLength={40} autoComplete="off" spellCheck={false}
              className="w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm font-mono" />
            <button type="button" disabled={versionLoading} onClick={() => void verifyGithubVersion()}
              className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-4 text-sm font-semibold text-white disabled:opacity-50">
              {versionLoading ? "Comprobando…" : "Verificar versión en GitHub"}
            </button>
            {versionStatus && <p role="status" className="text-sm">{versionStatus}</p>}
          </div>
          {repairError && <p role="alert" className="text-sm">{repairError}</p>}
          {repairPlan && <div role="status" className="space-y-3 rounded-lg bg-[var(--color-cream-50,#f8f7f2)] p-3 text-sm">
            <p><strong>Diagnóstico:</strong> {repairPlan.diagnosis}</p>
            <h4 className="font-semibold">Comprobaciones recomendadas</h4>
            <ul className="list-inside list-disc space-y-1">{repairPlan.suggestedChecks.map(item => <li key={item}>{item}</li>)}</ul>
            <h4 className="font-semibold">Archivos sugeridos</h4>
            <ul className="list-inside list-disc break-words">{repairPlan.suggestedFiles.map(item => <li key={item}>{item}</li>)}</ul>
            <p className="font-semibold">Pendiente de revisión humana. No se creó ningún PR ni se aplicaron cambios.</p>
          </div>}
        </div>}
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
            await loadTaskInbox();
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
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Bandeja real de PostgreSQL, disponible únicamente para administración de plataforma. Puedes enviar, revisar, aprobar o rechazar tareas; aprobar no ejecuta ninguna acción automáticamente.</p>
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
        {!taskInboxLoaded && !taskInboxLoading && <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Las tareas se consultan automáticamente al abrir Tower. Puedes actualizarlas manualmente.</p>}
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
