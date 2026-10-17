import { useMemo } from "react";

interface Task { id: string; agentId: string; title: string; priority: string; status: string; createdAt: string }
interface Agent { id: string; name: string; displayName?: string; department?: string }
const departments: Record<string,string> = { executive:"Dirección",secretariat:"Secretaría",technology:"Tecnología",compliance:"Cumplimiento",care:"Cuidado",finance:"Finanzas",support:"Soporte",marketing:"Mercadeo" };
export function TowerExecutiveSummary({ tasks, agents, loaded, loading, onRefresh }: { tasks: Task[]; agents: Agent[]; loaded: boolean; loading: boolean; onRefresh: () => void }) {
  const report = useMemo(() => {
    const agentDepartments = new Map(agents.map(agent => [agent.id, agent.department ?? "other"]));
    const counts = new Map<string,number>();
    for (const task of tasks) {
      if (task.status === "completed" || task.status === "rejected") continue;
      const department = agentDepartments.get(task.agentId) ?? "other";
      counts.set(department, (counts.get(department) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a,b) => b[1]-a[1]);
  }, [tasks,agents]);
  const pending = tasks.filter(task => task.status !== "completed" && task.status !== "rejected");
  const high = pending.filter(task => task.priority === "high");
  return <section aria-label="Tower Secretaría y Dirección" className="rounded-xl border border-[var(--color-border)] bg-white p-5">
    <h2 className="font-display text-2xl">Secretaría y Dirección · Resumen</h2>
    <p className="mt-2 text-sm">Resumen de tareas corporativas registradas en Tower. No incluye expedientes clínicos ni constituye una agenda de calendario. La consulta está limitada a las 50 tareas más recientes.</p>
    <button type="button" disabled={loading} onClick={onRefresh} className="mt-3 min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50">{loading ? "Actualizando…" : "Actualizar resumen"}</button>
    {!loaded ? <p className="mt-3 text-sm">El resumen estará disponible cuando se cargue la bandeja de tareas.</p> : <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border p-3"><p className="text-2xl font-semibold">{tasks.length}</p><p className="text-xs">Tareas consultadas</p></div>
        <div className="rounded-lg border p-3"><p className="text-2xl font-semibold">{pending.length}</p><p className="text-xs">Sin cierre</p></div>
        <div className="rounded-lg border p-3"><p className="text-2xl font-semibold">{high.length}</p><p className="text-xs">Prioridad alta sin cierre</p></div>
      </div>
      <h3 className="mt-4 font-semibold">Pendientes por departamento</h3>
      {report.length === 0 ? <p className="mt-2 text-sm">No hay pendientes en las tareas consultadas.</p> : <ul className="mt-2 space-y-2">{report.map(([id,count]) => <li key={id} className="flex justify-between rounded-lg border p-3 text-sm"><span>{departments[id] ?? "Otros"}</span><strong>{count}</strong></li>)}</ul>}
      {high.length > 0 && <><h3 className="mt-4 font-semibold">Prioridades para revisión administrativa</h3><ul className="mt-2 space-y-2">{high.slice(0,5).map(task => <li key={task.id} className="rounded-lg border p-3 text-sm">{task.title} · {task.status}</li>)}</ul></>}
    </>}
  </section>;
}
