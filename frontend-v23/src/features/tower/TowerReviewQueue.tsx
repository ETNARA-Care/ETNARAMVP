interface Task { id: string; agentId: string; title: string; priority: string; status: string; createdAt: string }
interface Agent { id: string; displayName?: string; department?: string }
export function TowerReviewQueue({tasks,agents,loaded,busy,onReview}:{tasks:Task[];agents:Agent[];loaded:boolean;busy:boolean;onReview:(task:Task,status:string)=>void}) {
  const queue=tasks.filter(task=>task.status==="submitted"||task.status==="in_review").sort((a,b)=>(a.priority==="high"?0:1)-(b.priority==="high"?0:1));
  return <section aria-label="Cola de revisión administrativa" className="rounded-xl border border-[var(--color-border)] bg-white p-5">
    <h2 className="font-display text-2xl">Cola de revisión administrativa</h2>
    <p className="mt-2 text-sm">Tareas enviadas o en revisión dentro de las 50 tareas consultadas. Aprobar una tarea no la ejecuta automáticamente.</p>
    {!loaded ? <p className="mt-3 text-sm">Esperando datos autorizados.</p> : queue.length===0 ? <p className="mt-3 text-sm">No hay tareas pendientes de revisión en esta consulta.</p> :
      <div className="mt-4 space-y-3">{queue.slice(0,10).map(task=><article key={task.id} className="rounded-lg border p-3">
        <h3 className="font-semibold">{task.title}</h3>
        <p className="mt-1 text-sm">{agents.find(a=>a.id===task.agentId)?.displayName??task.agentId} · {task.priority} · {task.status}</p>
        <div className="mt-3 flex flex-wrap gap-2">{(task.status==="submitted"?[{status:"in_review",label:"Iniciar revisión"},{status:"rejected",label:"Rechazar"}]:[{status:"approved",label:"Aprobar"},{status:"rejected",label:"Rechazar"}]).map(action=><button key={action.status} type="button" disabled={busy} onClick={()=>onReview(task,action.status)} className="min-h-11 rounded-lg border px-3 text-sm">{action.label}</button>)}</div>
      </article>)}</div>}
  </section>;
}
