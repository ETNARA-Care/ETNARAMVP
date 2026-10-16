import { useState, type FormEvent } from "react";

export function TowerTaskDraft({ agentName }: { agentName: string }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("normal");
  const [review, setReview] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReview(true);
  };
  return <section className="mt-6 border-t border-[var(--color-border)] pt-5" aria-label="Borrador de tarea">
    <h3 className="font-display text-2xl">Preparar solicitud de trabajo</h3>
    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Borrador local. No se guarda, no se envía ni ejecuta acciones. Evita incluir datos de pacientes o información confidencial.</p>
    <form className="mt-4 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">Título<input required maxLength={120} value={title} onChange={event => { setTitle(event.target.value); setReview(false); }} className="mt-2 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3" /></label>
      <label className="block text-sm font-medium">Instrucciones<textarea required maxLength={1500} rows={4} value={details} onChange={event => { setDetails(event.target.value); setReview(false); }} className="mt-2 block w-full rounded-lg border border-[var(--color-border)] p-3" /></label>
      <label className="block text-sm font-medium">Prioridad<select value={priority} onChange={event => { setPriority(event.target.value); setReview(false); }} className="mt-2 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3"><option value="normal">Normal</option><option value="alta">Alta</option><option value="baja">Baja</option></select></label>
      <div className="flex flex-wrap gap-3"><button type="submit" className="min-h-11 rounded-lg bg-[var(--color-navy-950)] px-5 text-sm font-semibold text-white">Revisar borrador</button><button type="button" onClick={() => { setTitle(""); setDetails(""); setPriority("normal"); setReview(false); }} className="min-h-11 rounded-lg border px-4 text-sm">Limpiar</button></div>
    </form>
    {review && <div className="mt-5 rounded-lg border border-[var(--color-border)] p-4" role="status"><p className="text-xs font-semibold uppercase">Vista previa · No enviado</p><h4 className="mt-2 font-semibold">{title}</h4><p className="mt-2 whitespace-pre-wrap text-sm">{details}</p><p className="mt-3 text-sm">Agente propuesto: {agentName} · Prioridad: {priority}</p><p className="mt-2 text-xs">No existe aún una asignación real ni almacenamiento de tareas.</p></div>}
  </section>;
}
