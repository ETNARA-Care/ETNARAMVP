import { useState } from "react";
import { getToken } from "@/auth/token";
import { apiClient } from "@/api/client";

const agents = [
  {id:"technology-2", name:"LEO", role:"Ingeniería de software"},
  {id:"technology-3", name:"ORION", role:"Arquitectura de sistemas"},
  {id:"technology-4", name:"AXEL", role:"Confiabilidad y operaciones"},
] as const;

export function TowerAiAdvisoryPanel() {
  const [agentId,setAgentId] = useState<string>(agents[0].id);
  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState("");
  const [model,setModel] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const analyze = async () => {
    const token = getToken();
    if (!token) { setMessage("Inicia sesión nuevamente."); return; }
    if (question.trim().length < 8 || question.trim().length > 1500) {
      setMessage("Escribe una consulta de 8 a 1500 caracteres."); return;
    }
    setBusy(true); setMessage(""); setAnswer(""); setModel("");
    try {
      const response = await apiClient.post<{answer:string;model:string;mode:string}>(
        "/platform/tower/ai/analyze", {agentId,question:question.trim()}, token);
      if (response.mode !== "advisory-only") throw new Error("Unexpected response");
      setAnswer(response.answer); setModel(response.model);
    } catch {
      setMessage("El análisis de IA no está disponible. Comprueba que el administrador haya configurado y activado el proveedor de IA.");
    } finally { setBusy(false); }
  };
  return <section aria-label="Asesores IA de Tower" className="rounded-xl border border-[var(--color-border)] bg-white p-6">
    <h2 className="font-display text-2xl">Tower Intelligence · Asesores IA</h2>
    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Piloto de consultas bajo demanda. Sin ejecución autónoma, acceso a expedientes ni cambios en sistemas.</p>
    <label className="mt-4 block text-sm font-semibold">Seleccionar agente
      <select aria-label="Agente asesor de IA" value={agentId} onChange={event=>{setAgentId(event.target.value);setAnswer("");setMessage("");}}
        className="mt-1 block w-full rounded-lg border border-[var(--color-border)] p-3">
        {agents.map(agent=><option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}
      </select>
    </label>
    <label className="mt-4 block text-sm font-semibold">Tu consulta
      <textarea aria-label="Consulta para asesor IA" value={question} maxLength={1500} rows={4}
        onChange={event=>setQuestion(event.target.value)} placeholder="Describe un problema técnico sin incluir contraseñas, información de pacientes ni datos sensibles."
        className="mt-1 block w-full rounded-lg border border-[var(--color-border)] p-3" />
    </label>
    <button type="button" disabled={busy || question.trim().length<8} onClick={()=>void analyze()}
      className="mt-3 min-h-11 rounded-lg border border-[var(--color-border)] px-5 font-semibold disabled:opacity-50">
      {busy?"Analizando…":"Solicitar análisis"}
    </button>
    {message && <p role="alert" className="mt-3 text-sm">{message}</p>}
    {answer && <div aria-live="polite" className="mt-4 rounded-lg border border-[var(--color-border)] p-4">
      <p className="text-sm font-semibold">Propuesta de {agents.find(agent=>agent.id===agentId)?.name} · {model}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{answer}</p>
      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Respuesta generada por IA. Verifica los datos antes de tomar decisiones. Ninguna acción fue ejecutada.</p>
    </div>}
  </section>;
}
