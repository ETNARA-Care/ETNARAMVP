interface Task { id: string; agentId: string; title: string; status: string }
interface Agent { id: string; department?: string }
const groups = [{id:"finance",name:"Finanzas"},{id:"support",name:"Soporte"},{id:"marketing",name:"Mercadeo"}];
export function TowerBusinessDepartments({tasks,agents,loaded}:{tasks:Task[];agents:Agent[];loaded:boolean}) {
  const byAgent = new Map(agents.map(a=>[a.id,a.department]));
  return <section aria-label="Departamentos comerciales" className="rounded-xl border p-5">
    <h2 className="font-display text-2xl">Finanzas, Soporte y Mercadeo</h2>
    <p className="mt-2 text-sm">Resumen de tareas corporativas registradas. No representa transacciones, tickets ni publicaciones reales.</p>
    {!loaded ? <p className="mt-3 text-sm">Esperando tareas autorizadas.</p> : <div className="mt-4 grid gap-3 md:grid-cols-3">{groups.map(g=>{
      const items=tasks.filter(t=>byAgent.get(t.agentId)===g.id);
      const open=items.filter(t=>t.status!=="completed"&&t.status!=="rejected");
      return <article key={g.id} className="rounded-lg border p-3"><h3 className="font-semibold">{g.name}</h3><p className="mt-2 text-sm">{open.length} pendientes de {items.length} tareas consultadas</p><ul className="mt-2 space-y-2">{open.slice(0,5).map(t=><li key={t.id} className="text-sm">{t.title} · {t.status}</li>)}</ul></article>;
    })}</div>}
  </section>;
}
