import { useEffect, useRef, useState } from "react";
import type { TowerFloor } from "./floors";

const departmentTools: Record<string, { title: string; purpose: string; templates: readonly { title: string; instructions: string }[] }> = {
  compliance: { title: "Cumplimiento y expedientes", purpose: "Preparación administrativa; no accede a expedientes clínicos ni certifica cumplimiento.", templates: [
    { title: "Revisar documentos próximos a vencer", instructions: "Preparar una revisión administrativa de documentos y credenciales próximos a vencer en la organización autorizada. No modificar expedientes." },
    { title: "Preparar lista de inspección", instructions: "Preparar una lista de verificación documental para inspección del establecimiento, sin afirmar cumplimiento sin evidencia." }] },
  care: { title: "Operaciones de cuidado", purpose: "Planificación operativa sin acceder a información clínica ni ejecutar cambios.", templates: [
    { title: "Revisar cobertura de turnos", instructions: "Preparar una revisión de cobertura de turnos y posibles vacantes dentro de la organización autorizada." },
    { title: "Preparar seguimiento de incidentes", instructions: "Preparar una revisión administrativa de incidentes pendientes sin incluir datos identificables de pacientes." }] },
  finance: { title: "Finanzas y crecimiento", purpose: "Análisis y propuestas; no autoriza pagos ni consulta cuentas bancarias.", templates: [
    { title: "Preparar reporte de suscripciones", instructions: "Preparar una propuesta de reporte de suscripciones y facturación de la organización autorizada; no procesar pagos." },
    { title: "Revisar indicadores comerciales", instructions: "Preparar una lista de indicadores comerciales para revisión administrativa sin inventar cifras." }] },
  support: { title: "Experiencia y soporte", purpose: "Clasificación de solicitudes; no responde a usuarios ni modifica tickets automáticamente.", templates: [
    { title: "Clasificar solicitudes pendientes", instructions: "Preparar criterios para clasificar solicitudes de soporte por urgencia y categoría." },
    { title: "Preparar guía de atención", instructions: "Preparar un borrador de guía para responder consultas frecuentes de usuarios de ETNARA Care." }] },
  secretariat: { title: "Secretaría ejecutiva", purpose: "Borradores y coordinación; no envía mensajes ni modifica calendarios.", templates: [
    { title: "Preparar agenda administrativa", instructions: "Preparar una agenda de seguimiento para los asuntos pendientes de la administración." },
    { title: "Preparar minuta de reunión", instructions: "Preparar una plantilla de minuta para revisión y aprobación de la administración." }] },
  marketing: { title: "Mercadeo y redes sociales", purpose: "Propuestas editoriales; no publica contenido en redes sociales.", templates: [
    { title: "Preparar calendario de contenido", instructions: "Preparar una propuesta de calendario editorial para ETNARA Care sin publicar contenidos." },
    { title: "Revisar mensajes de marca", instructions: "Preparar una revisión de mensajes de marca y propuestas de mejora para aprobación administrativa." }] },
  executive: { title: "Dirección ejecutiva", purpose: "Priorización estratégica; no toma decisiones ni aprueba tareas automáticamente.", templates: [
    { title: "Preparar prioridades semanales", instructions: "Preparar una lista de prioridades estratégicas y decisiones pendientes para la dirección." },
    { title: "Revisar avances de departamentos", instructions: "Preparar una propuesta de revisión de avances y bloqueos por departamento." }] },
  technology: { title: "Tecnología y sistemas", purpose: "Planificación técnica; los diagnósticos reales requieren herramientas autorizadas.", templates: [
    { title: "Preparar revisión de despliegue", instructions: "Preparar una lista de comprobación para revisar un despliegue de ETNARA Care sin modificar infraestructura." },
    { title: "Preparar análisis de incidencia", instructions: "Preparar una investigación técnica de incidencia con pasos de diagnóstico y sin ejecutar cambios." }] },
};
interface DeskTask { id: string; agentId: string; title: string; status: string; priority: string }
interface Props { onAgentMessage?: (agentId: string, message: string) => Promise<string>; floors: readonly TowerFloor[]; onSelect: (departmentId: string) => void; onSelectAgent?: (agentId: string) => void; onPrepareInstruction?: (agentId: string) => void; onSaveAgentTask?: (agentId: string, title: string, instructions: string, priority: "low" | "normal" | "high") => Promise<string>; tasks: readonly DeskTask[]; tasksLoaded: boolean; tasksLoading: boolean; tasksError: string; onRefreshTasks: () => void; onUnsupported: () => void }
const vertex = `attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uMatrix;
varying vec3 vColor;
void main(){gl_Position=uMatrix*vec4(aPosition,1.0);vColor=aColor;}`;
const fragment = `precision mediump float;
varying vec3 vColor;
void main(){gl_FragColor=vec4(vColor,1.0);}`;
function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) throw Error("WebGL shader unavailable");
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error ?? "Shader error"); }
  return s;
}
function multiply(a: number[], b: number[]) {
  const o=Array(16).fill(0);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)o[col*4+row]+=a[k*4+row]*b[col*4+k];
  return o;
}
function geometry(floors: readonly TowerFloor[], interior: TowerFloor | null) {
  const positions:number[]=[], colors:number[]=[];
  function quad(a:number[],b:number[],c:number[],d:number[],color:number[]) {
    for(const p of [a,b,c,a,c,d]) {positions.push(...p);colors.push(...color);}
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:number[]) {
    const x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;
    quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],color);
    quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],color.map(v=>v*.75));
    quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],color.map(v=>v*.82));
    quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],color.map(v=>v*.9));
    quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],color.map(v=>Math.min(1,v*1.2)));
  }
  if (interior) {
    // Architectural cutaway: floor slab, rear glazing, desk islands and meeting area.
    box(0,-.75,0,9,.32,7,[.72,.68,.58]);
    box(0,-.42,-3.35,9,3.8,.2,[.14,.30,.40]);
    box(-4.4,-.42,0,.18,3.8,6.7,[.20,.38,.46]);
    box(4.4,-.42,0,.18,3.8,6.7,[.20,.38,.46]);
    for (const x of [-3.4,-1.7,0,1.7,3.4]) box(x,-.4,-3.17,.045,3.3,.07,[.68,.71,.67]);
    box(0,3.3,-.3,9,.2,6.2,[.57,.63,.54]);
    interior.agents.forEach((agent,i)=>{
      const x=-2.8+(i%3)*2.8,z=-1.55+Math.floor(i/3)*2.45;
      box(x,-.4,z,1.65,.72,.85,[.65,.52,.38]);
      box(x,-.4,z-.38,1.65,.05,.12,[.81,.68,.49]);
      box(x,-.1,z-.12,.78,.48,.09,[.10,.19,.28]);
      box(x,-.35,z+1,.65,.46,.65,[.34,.51,.43]);
      void agent;
    });
    box(0,-.4,2.65,2.4,.25,.95,[.74,.64,.46]);
    return {positions:new Float32Array(positions),colors:new Float32Array(colors)};
  }
  // Elevated travertine plaza and entrance canopy.
  box(0,-.9,0,9,.4,7.5,[.68,.66,.59]);
  box(0,-.48,0,7.8,.4,5.7,[.79,.76,.67]);
  box(0,-.08,3.05,4.5,.18,1.7,[.74,.61,.42]);
  for(const x of [-1.95,1.95]) box(x,-.08,3.55,.14,1.2,.14,[.73,.62,.46]);
  box(0,-.06,2.91,2.6,1.05,.06,[.19,.35,.42]);
  for(const x of [-4.05,4.05]) {
    box(x,-.08,0,.28,.62,4.9,[.30,.43,.37]);
    for(let z=-2;z<=2;z+=.8)box(x,-.08,z,.45,.88,.35,[.24,.40,.30]);
  }
  floors.forEach((floor,i)=>{
    const width=6.1-i*.12,depth=4.6-i*.07,y=i*1.28;
    box(0,y,0,width,1.15,depth,[.10+i*.006,.21+i*.008,.32+i*.007]);
    box(0,y,0,width+.18,.09,depth+.18,[.48,.66,.52]);
    box(0,y+1.06,0,width+.18,.09,depth+.18,[.48,.66,.52]);
    // Reflective blue-glass bays with metallic mullions on every elevation.
    for(let j=1;j<7;j++){const x=-width/2+j*width/7;
      box(x,y+.1,depth/2+.035,.035,.93,.04,[.66,.71,.72]);
      box(x,y+.1,-depth/2-.035,.035,.93,.04,[.56,.64,.66]);
    }
    for(let j=1;j<5;j++){const z=-depth/2+j*depth/5;
      box(-width/2-.035,y+.1,z,.04,.93,.035,[.58,.66,.67]);
      box(width/2+.035,y+.1,z,.04,.93,.035,[.58,.66,.67]);
    }
    // Subtle illuminated windows: emissive-looking warm bands in the front elevation.
    for(let j=0;j<5;j++){const x=-width/2+(j+.5)*width/5;box(x,y+.4,depth/2+.06,width/9,.18,.025,[.78,.60,.39]);}
    void floor;
  });
  const crownY=floors.length*1.28;
  box(0,crownY,0,5.0,.35,3.8,[.75,.65,.43]);
  box(0,crownY+.35,0,4.4,.48,3.4,[.16,.27,.38]);
  for(const x of [-2.1,2.1])box(x,crownY+.8,0,.1,.48,3.4,[.78,.65,.42]);
  box(0,crownY+1.24,0,4.7,.12,3.7,[.78,.65,.42]);
  return {positions:new Float32Array(positions),colors:new Float32Array(colors)};
}
/** True WebGL-rendered geometric exterior; no external CDN or runtime dependencies. */
export default function TowerWebGL({floors,onSelect,onSelectAgent,onAgentMessage,onSaveAgentTask,tasks,tasksLoaded,tasksLoading,tasksError,onRefreshTasks,onUnsupported}:Props) {
  const canvas=useRef<HTMLCanvasElement>(null), [failed,setFailed]=useState(false);
  const rotation=useRef(.46);
  const [interiorId,setInteriorId]=useState<string | null>(null);
  const [activeAgentId,setActiveAgentId]=useState<string | null>(null);
  const [deskTab,setDeskTab]=useState<"profile" | "tasks" | "chat">("profile");
  const [taskDraftTitle,setTaskDraftTitle]=useState("");
  const [taskDraftInstructions,setTaskDraftInstructions]=useState("");
  const [taskDraftPriority,setTaskDraftPriority]=useState<"low"|"normal"|"high">("normal");
  const [taskSaving,setTaskSaving]=useState(false);
  const [taskFeedback,setTaskFeedback]=useState("");
  const saveDeskTask=async(agentId:string)=>{
    if(!onSaveAgentTask||taskSaving||taskDraftTitle.trim().length<3||taskDraftInstructions.trim().length<5)return;
    setTaskSaving(true);setTaskFeedback("");
    try{const result=await onSaveAgentTask(agentId,taskDraftTitle.trim(),taskDraftInstructions.trim(),taskDraftPriority);setTaskFeedback(result);if(result.startsWith("Borrador guardado")){setTaskDraftTitle("");setTaskDraftInstructions("");}}
    catch{setTaskFeedback("No se pudo guardar la tarea. No se realizó ninguna acción.");}
    finally{setTaskSaving(false);}
  };
  const [chatDraft,setChatDraft]=useState("");
  const [chatBusy,setChatBusy]=useState(false);
  const [chatHistory,setChatHistory]=useState<Record<string,{role:"user"|"agent";text:string}[]>>({});
  const sendChat=async(agentId:string)=>{
    const message=chatDraft.trim();if(!message||chatBusy||message.length>1000)return;
    setChatDraft("");setChatBusy(true);
    setChatHistory(old=>({...old,[agentId]:[...(old[agentId]??[]),{role:"user",text:message}]}));
    try {
      const answer=onAgentMessage ? await onAgentMessage(agentId,message) : "Este agente aún no tiene un motor conversacional conectado. Puedes preparar una tarea para revisión.";
      setChatHistory(old=>({...old,[agentId]:[...(old[agentId]??[]),{role:"agent",text:answer}]}));
    }catch{setChatHistory(old=>({...old,[agentId]:[...(old[agentId]??[]),{role:"agent",text:"No se pudo completar la consulta. No se realizaron acciones."}]}));}
    finally{setChatBusy(false);}
  };
  const interior=floors.find(floor=>floor.departmentId===interiorId) ?? null;
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const gl=element.getContext("webgl",{antialias:true,alpha:false});
    if(!gl){setFailed(true);return;}
    let program:WebGLProgram|null=null,positionBuffer:WebGLBuffer|null=null,colorBuffer:WebGLBuffer|null=null;
    let frame=0;
    try {
      program=gl.createProgram();if(!program)throw Error("WebGL program unavailable");
      const vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error("WebGL link failed");
      const g=geometry(floors,interior);
      positionBuffer=gl.createBuffer();colorBuffer=gl.createBuffer();
      if(!positionBuffer||!colorBuffer)throw Error("WebGL buffer unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferData(gl.ARRAY_BUFFER,g.positions,gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.bufferData(gl.ARRAY_BUFFER,g.colors,gl.STATIC_DRAW);
      const p=gl.getAttribLocation(program,"aPosition"),c=gl.getAttribLocation(program,"aColor"),m=gl.getUniformLocation(program,"uMatrix");
      if(p<0||c<0||!m)throw Error("WebGL attribute unavailable");
      const render=()=>{
        const width=element.clientWidth,height=element.clientHeight;
        if(width===0||height===0)return;
        const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
        if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
        gl.viewport(0,0,w,h);gl.clearColor(.043,.086,.149,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(program);
        const aspect=w/h,f=1/Math.tan(Math.PI/7),near=.1,far=100;
        const proj=[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
        const a=rotation.current,co=Math.cos(a),si=Math.sin(a);
        const turn=[co,0,-si,0,0,1,0,0,si,0,co,0,0,0,0,1];
        const tilt=[1,0,0,0,0,.94,.34,0,0,-.34,.94,0,0,0,0,1];
        const move=[1,0,0,0,0,1,0,0,0,0,1,0,0,interior ? -1 : -5.4,interior ? -15 : -24,1];
        gl.uniformMatrix4fv(m,false,new Float32Array(multiply(proj,multiply(move,multiply(tilt,turn)))));
        gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(c,3,gl.FLOAT,false,0,0);
        gl.drawArrays(gl.TRIANGLES,0,g.positions.length/3);
      };
      let lastX:number|null=null;
      const down=(e:PointerEvent)=>{lastX=e.clientX;element.setPointerCapture(e.pointerId);};
      const movePointer=(e:PointerEvent)=>{if(lastX===null)return;rotation.current+=(e.clientX-lastX)*.008;lastX=e.clientX;render();};
      const up=()=>{lastX=null;};
      const resize=()=>{frame=requestAnimationFrame(render);};
      const observer=new ResizeObserver(resize);observer.observe(element);
      element.addEventListener("pointerdown",down);element.addEventListener("pointermove",movePointer);element.addEventListener("pointerup",up);element.addEventListener("pointercancel",up);
      render();
      return ()=>{cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener("pointerdown",down);element.removeEventListener("pointermove",movePointer);element.removeEventListener("pointerup",up);element.removeEventListener("pointercancel",up);if(positionBuffer)gl.deleteBuffer(positionBuffer);if(colorBuffer)gl.deleteBuffer(colorBuffer);if(program)gl.deleteProgram(program);};
    }catch{setFailed(true);if(positionBuffer)gl.deleteBuffer(positionBuffer);if(colorBuffer)gl.deleteBuffer(colorBuffer);if(program)gl.deleteProgram(program);}
  },[floors,interior]);
  if(failed)return <div role="status" className="rounded-lg border p-4">El visor 3D no está disponible en este dispositivo. <button type="button" onClick={onUnsupported} className="underline">Abrir vista 2D</button></div>;
  const activeAgent=interior?.agents.find(agent=>agent.id===activeAgentId);
  const enterFloor=(floor:TowerFloor)=>{setInteriorId(floor.departmentId);setActiveAgentId(null);setDeskTab("profile");rotation.current=.46;onSelect(floor.departmentId);};
  return <div className="relative min-w-0 overflow-hidden rounded-xl bg-[#0b1626]">
    {interior && <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-[#0b1626]/95 p-2 text-xs text-white">
      <button type="button" onClick={()=>{setInteriorId(null);setActiveAgentId(null);}} className="min-h-10 shrink-0 rounded border border-white/30 px-3">← Edificio</button>
      <span className="truncate">Oficina 3D · {interior.name}</span>
    </div>}
    <canvas ref={canvas} aria-label={interior ? `Modelo 3D de la oficina de ${interior.name}. Arrastra para girar.` : "Modelo tridimensional de ETNARA Tower. Arrastra para girar."} className="h-[360px] w-full cursor-grab touch-pan-y sm:h-[480px]" />
    {!interior && <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2" aria-label="Seleccionar piso 3D">{floors.map(f=><button key={f.departmentId} type="button" onClick={()=>enterFloor(f)} aria-label={`Entrar a la oficina 3D del piso ${f.number}: ${f.name}`} className="min-h-10 min-w-10 rounded-md border border-white/25 bg-[#0b1626]/90 px-2 py-1 text-xs text-white hover:bg-[#294b45]">{f.number}</button>)}</div>}
    {interior && <div className="border-t border-[#9db89e]/30 bg-[#10253a] p-3 text-white sm:p-4" aria-label={`Personal de ${interior.name}`}>
      <p className="text-xs uppercase tracking-widest text-[#c9ae7c]">Piso {interior.number} · Puestos virtuales ({interior.agents.length})</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{interior.agents.map(agent=><button key={agent.id} type="button" aria-pressed={activeAgentId===agent.id} onClick={()=>{setActiveAgentId(agent.id);setDeskTab("chat");onSelectAgent?.(agent.id);}} className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm ${activeAgentId===agent.id ? "border-[#9db89e] bg-[#254339]" : "border-white/20 bg-white/5 hover:bg-white/10"}`}>
        <span className="block font-semibold">{agent.displayName ?? agent.name}</span><span className="block text-xs text-[#b9cfc5]">{agent.name}</span>
      </button>)}</div>
      {activeAgent && <div className="mt-3 rounded-lg border border-[#c9ae7c]/40 bg-[#0b1626] p-3" aria-label={`Escritorio virtual de ${activeAgent.displayName ?? activeAgent.name}`}>
        <p className="text-sm font-semibold">{activeAgent.displayName ?? activeAgent.name} · {activeAgent.name}</p>
        <p className="mt-1 text-xs text-[#b9cfc5]">Puesto en preparación · sin ejecución autónoma</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Secciones del escritorio 3D">
          <button type="button" aria-pressed={deskTab==="profile"} onClick={()=>setDeskTab("profile")} className={`min-h-11 rounded-lg border px-3 text-xs ${deskTab==="profile"?"border-[#9db89e] bg-[#254339]":"border-white/25"}`}>Perfil</button>
          <button type="button" aria-pressed={deskTab==="tasks"} onClick={()=>setDeskTab("tasks")} className={`min-h-11 rounded-lg border px-3 text-xs ${deskTab==="tasks"?"border-[#9db89e] bg-[#254339]":"border-white/25"}`}>Tareas y herramientas</button>
          <button type="button" aria-pressed={deskTab==="chat"} onClick={()=>setDeskTab("chat")} className={`min-h-11 rounded-lg border px-3 text-xs ${deskTab==="chat"?"border-[#9db89e] bg-[#254339]":"border-white/25"}`}>Conversar</button>
        </div>
        {deskTab==="chat" ? <div className="mt-3 space-y-3" aria-label={`Conversación con ${activeAgent.displayName ?? activeAgent.name}`}>
          <p className="text-xs text-[#c9ae7c]">Piloto supervisado · No es un chat de IA autónoma. AXEL y ORION pueden consultar diagnósticos reales; los demás agentes aún no tienen motor conversacional.</p>
          <div role="log" aria-live="polite" className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-white/15 p-3">
            {(chatHistory[activeAgent.id]??[]).length===0 && <p className="text-xs text-[#9da9bb]">Escribe una pregunta. No incluyas datos de pacientes ni información sensible.</p>}
            {(chatHistory[activeAgent.id]??[]).map((msg,i)=><div key={i} className={`whitespace-pre-wrap break-words rounded-lg p-2 text-sm ${msg.role==="user"?"ml-6 bg-[#254339]":"mr-6 bg-white/10"}`}><span className="block text-xs text-[#c9ae7c]">{msg.role==="user"?"Tú":activeAgent.displayName??activeAgent.name}</span>{msg.text}</div>)}
          </div>
          <form onSubmit={event=>{event.preventDefault();void sendChat(activeAgent.id);}} className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="Mensaje al agente" maxLength={1000} value={chatDraft} onChange={event=>setChatDraft(event.target.value)} placeholder="Escribe tu pregunta…" className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/30 bg-[#142b3b] px-3 text-sm text-white placeholder:text-white/50" />
            <button type="submit" disabled={chatBusy||!chatDraft.trim()} className="min-h-11 rounded-lg bg-[#9db89e] px-4 text-sm font-semibold text-[#0b1626] disabled:opacity-50">{chatBusy?"Consultando…":"Enviar"}</button>
          </form>
          <p className="text-xs text-[#9da9bb]">Mensajes temporales en esta sesión; no se guardan en el servidor.</p>
        </div> : deskTab==="profile" ? <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-[#e0e5e3]">{activeAgent.responsibilities.map((item,i)=><li key={i}>{item}</li>)}</ul> : <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[#c9ae7c]">Bandeja de tareas · Solo lectura</p><button type="button" onClick={onRefreshTasks} disabled={tasksLoading} className="min-h-10 rounded border border-white/30 px-3 text-xs disabled:opacity-50">{tasksLoading?"Consultando…":"Actualizar"}</button></div>
          {tasksError && <p role="alert" className="text-xs">{tasksError}</p>}
          {!tasksLoaded && !tasksLoading && <p className="text-xs text-[#9da9bb]">Actualiza para consultar las tareas guardadas.</p>}
          {tasksLoaded && tasks.filter(task=>task.agentId===activeAgent.id).length===0 && <p className="text-xs text-[#9da9bb]">No hay tareas guardadas para este agente.</p>}
          {tasksLoaded && <ul className="space-y-2">{tasks.filter(task=>task.agentId===activeAgent.id).map(task=><li key={task.id} className="rounded border border-white/20 p-2 text-xs"><span className="font-semibold">{task.title}</span><span className="mt-1 block text-[#9da9bb]">{task.status} · {task.priority}</span></li>)}</ul>}
          <div className="rounded-lg border border-white/20 p-3">
            <p className="text-sm font-semibold">{departmentTools[interior.departmentId]?.title ?? "Herramientas del departamento"}</p>
            <p className="mt-1 text-xs text-[#9da9bb]">{departmentTools[interior.departmentId]?.purpose}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(departmentTools[interior.departmentId]?.templates ?? []).map(template=><button key={template.title} type="button" onClick={()=>{setTaskDraftTitle(template.title);setTaskDraftInstructions(template.instructions);setTaskFeedback("");}} className="min-h-11 rounded-lg border border-[#9db89e]/60 px-3 text-left text-xs hover:bg-white/10">{template.title}</button>)}
            </div>
            <p className="mt-2 text-xs text-[#9da9bb]">Estas herramientas preparan borradores. No consultan datos operativos ni ejecutan acciones.</p>
          </div>
          <form className="space-y-2 rounded-lg border border-white/20 p-3" onSubmit={event=>{event.preventDefault();void saveDeskTask(activeAgent.id);}}>
            <p className="text-sm font-semibold">Nueva tarea para {activeAgent.displayName??activeAgent.name}</p>
            <label className="block text-xs" htmlFor="tower-desk-task-title">Título</label>
            <input id="tower-desk-task-title" required minLength={3} maxLength={120} value={taskDraftTitle} onChange={event=>setTaskDraftTitle(event.target.value)} className="min-h-11 w-full rounded-lg border border-white/30 bg-[#142b3b] px-3 text-sm text-white" placeholder="Ej. Revisar credenciales pendientes"/>
            <label className="block text-xs" htmlFor="tower-desk-task-instructions">Instrucciones</label>
            <textarea id="tower-desk-task-instructions" required minLength={5} maxLength={1200} rows={3} value={taskDraftInstructions} onChange={event=>setTaskDraftInstructions(event.target.value)} className="w-full rounded-lg border border-white/30 bg-[#142b3b] p-3 text-sm text-white" placeholder="Describe el trabajo que deseas preparar"/>
            <label className="block text-xs" htmlFor="tower-desk-task-priority">Prioridad</label>
            <select id="tower-desk-task-priority" value={taskDraftPriority} onChange={event=>setTaskDraftPriority(event.target.value as "low"|"normal"|"high")} className="min-h-11 w-full rounded-lg border border-white/30 bg-[#142b3b] px-3 text-sm text-white"><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select>
            <button type="submit" disabled={taskSaving||!onSaveAgentTask||taskDraftTitle.trim().length<3||taskDraftInstructions.trim().length<5} className="min-h-11 rounded-lg bg-[#9db89e] px-4 text-sm font-semibold text-[#0b1626] disabled:opacity-50">{taskSaving?"Guardando…":"Guardar tarea para revisión"}</button>
            {taskFeedback&&<p role="status" className="whitespace-pre-wrap text-xs">{taskFeedback}</p>}
          </form>
          <p className="text-xs text-[#9da9bb]">La instrucción se prepara para revisión administrativa. No se ejecuta automáticamente.</p>
        </div>}
      </div>}
    </div>}
  </div>;
}
