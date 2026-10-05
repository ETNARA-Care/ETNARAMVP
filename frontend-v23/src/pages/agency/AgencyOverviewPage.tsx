import { AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, Clock3, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { recipientName } from "@/api/shifts";
import { isToday, useAgencySupervision, type AdminCareEvent, type AdminShift } from "@/features/agency/useAgencySupervision";

const eventLabel: Record<string, string> = {
  MEAL: "Comida registrada", HYDRATION: "Hidratación registrada", TOILETING: "Asistencia al baño",
  MOBILITY: "Movilidad registrada", ACTIVITY: "Actividad registrada", MOOD: "Estado de ánimo", NOTE: "Nota de cuidado",
};
function caregiverName(shift: AdminShift) { return shift.caregiver?.display_name ?? shift.caregiver?.internal_role ?? "Sin cuidador asignado"; }
function eventDetail(event: AdminCareEvent) {
  if (event.note_text) return event.note_text;
  if (!event.structured_data || typeof event.structured_data !== "object") return null;
  const d = event.structured_data as Record<string, unknown>;
  const value = d.label ?? d.mealType ?? d.amount ?? d.result ?? d.activity ?? d.mood;
  return typeof value === "string" ? value : null;
}
function Panel({children,className=""}:{children:React.ReactNode;className?:string}) {
  return <section className={`min-w-0 overflow-hidden rounded-[22px] border border-[#e5dfd2] bg-white shadow-[0_10px_35px_rgba(19,41,75,.055)] ${className}`}>{children}</section>;
}
function PanelTitle({title,sub,action}:{title:string;sub?:string;action?:React.ReactNode}) {
  return <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6"><div><h2 className="font-display text-[1.3rem] font-medium tracking-[-.02em] text-[#17202e]">{title}</h2>{sub&&<p className="mt-1 text-sm text-[#545e6e]">{sub}</p>}</div>{action}</div>;
}
export function AgencyOverviewPage() {
  const navigate=useNavigate();
  const {loading,error,shifts,events,reload}=useAgencySupervision();
  if(loading) return <div className="grid gap-4"><Skeleton className="h-32"/><Skeleton className="h-72"/><Skeleton className="h-56"/></div>;
  if(error) return <ErrorState kind="server" onRetry={()=>void reload()}/>;
  const todayShifts=shifts.filter(s=>isToday(s.scheduled_start));
  const todayEvents=events.filter(e=>isToday(e.occurred_at));
  const covered=todayShifts.filter(s=>Boolean(s.caregiver)).length;
  const unassigned=todayShifts.filter(s=>!s.caregiver&&s.status!=="cancelled");
  const activeNow=todayShifts.filter(s=>s.status==="in_progress").length;
  const recent=[...todayEvents].sort((a,b)=>new Date(b.occurred_at).getTime()-new Date(a.occurred_at).getTime()).slice(0,6);
  const urgent=unassigned.length;
  const fmt=(v:string)=>new Intl.DateTimeFormat("es-PR",{hour:"numeric",minute:"2-digit"}).format(new Date(v));
  return <div className="space-y-6 pb-8 lg:space-y-8">
    <header className="min-w-0 border-b border-[#e5dfd2] pb-6">
      <p className="text-sm text-[#808894]">Centro administrativo ETNARA</p>
      <h1 className="mt-2 max-w-[28ch] font-display text-[2rem] font-normal leading-[1.08] tracking-[-.035em] text-[#17202e] sm:text-[2.65rem]">
        {urgent>0?`Hoy hay ${urgent} ${urgent===1?"asunto urgente":"asuntos urgentes"} que requieren atención.`:"La operación de hoy está bajo control."}
      </h1>
      <dl className="mt-7 grid grid-cols-2 gap-y-5 border-y border-[#e5dfd2] py-5 md:grid-cols-4 md:divide-x md:divide-[#e5dfd2]">
        {[
          ["Turnos hoy",todayShifts.length,String(covered)+" cubiertos"],
          ["En curso",activeNow,"ahora"],
          ["Sin cubrir",unassigned.length,unassigned.length?"requieren acción":"todo cubierto"],
          ["Registros de cuidado",todayEvents.length,"hoy"],
        ].map(([label,value,sub],i)=><div key={label} className={i%2?"border-l border-[#e5dfd2] pl-5 md:px-6":"pr-4 md:px-6 md:first:pl-0"}>
          <dt className="text-sm text-[#545e6e]">{label}</dt><dd className="mt-1 font-display text-3xl leading-none text-[#17202e]">{value}</dd>
          <dd className={`mt-1.5 text-xs ${label==="Sin cubrir"&&Number(value)>0?"font-semibold text-[#9e3b32]":"text-[#808894]"}`}>{sub}</dd>
        </div>)}
      </dl>
    </header>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Panel className="xl:col-span-8">
        <PanelTitle title="Requiere atención" sub="Prioridades operacionales de hoy."/>
        <div className="mt-4 border-t border-[#e5dfd2]">
          {unassigned.length?unassigned.slice(0,4).map((s,i)=><div key={s.id} className="relative flex flex-col gap-3 border-b border-[#e5dfd2] py-4 pl-6 pr-5 last:border-0 sm:flex-row sm:items-center">
            <span className="absolute bottom-4 left-0 top-4 w-[3px] rounded-r bg-[#9e3b32]"/>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs"><span className="font-semibold text-[#9e3b32]">{i===0?"Urgente":"Atención"}</span><span className="text-[#808894]">Workforce</span></div>
              <p className="mt-1 font-medium text-[#17202e]">Turno sin cubrir para {recipientName(s)}</p><p className="mt-0.5 text-sm text-[#545e6e]">{fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}</p></div>
            <button onClick={()=>navigate("/agency/shifts")} className="inline-flex h-9 items-center gap-1 self-start rounded-lg bg-[#13294b] px-3.5 text-sm font-medium text-white sm:self-center">Asignar <ArrowRight size={15}/></button>
          </div>):<div className="flex items-center gap-3 px-6 py-8"><CheckCircle2 className="text-[#567a60]"/><div><p className="font-medium text-[#17202e]">No hay turnos descubiertos</p><p className="text-sm text-[#545e6e]">La cobertura programada para hoy está completa.</p></div></div>}
        </div>
      </Panel>

      <Panel className="bg-[#13294b] text-white xl:col-span-4">
        <div className="p-6"><div className="flex items-center gap-2 text-[#dfe6ee]"><ShieldCheck size={18}/><span className="text-xs font-semibold uppercase tracking-[.16em]">ETNARA Compliance</span></div>
          <h2 className="mt-5 font-display text-2xl leading-tight">Preparación para inspección</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#dfe6ee]/75">Revisa documentos, credenciales y requisitos de tu organización desde un solo lugar.</p>
          <div className="my-6 h-px bg-white/12"/><button onClick={()=>navigate("/agency/compliance")} className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15"><span>Abrir Compliance</span><ArrowRight size={16}/></button>
        </div>
      </Panel>

      <Panel className="xl:col-span-12">
        <PanelTitle title="Turnos de hoy" sub={`${covered} de ${todayShifts.length} cubiertos · ${activeNow} en curso`} action={<Button icon={<CalendarPlus size={16}/>} onClick={()=>navigate("/agency/shifts?create=1")}>Crear turno</Button>}/>
        {todayShifts.length?<div className="mt-5 grid gap-0 border-t border-[#e5dfd2] md:grid-cols-2 xl:grid-cols-3">{todayShifts.slice(0,9).map(s=><button key={s.id} onClick={()=>navigate("/agency/shifts")} className={`min-w-0 border-b border-[#e5dfd2] p-5 text-left transition hover:bg-[#faf8f3] md:border-r ${!s.caregiver?"bg-[#f6e2de]/40":""}`}>
          <div className="flex items-center justify-between gap-2"><span className={`text-xs font-semibold ${!s.caregiver?"text-[#9e3b32]":s.status==="in_progress"?"text-[#567a60]":"text-[#808894]"}`}>{!s.caregiver?"SIN CUBRIR":s.status==="in_progress"?"EN CURSO":"PROGRAMADO"}</span><Clock3 size={15} className="text-[#808894]"/></div>
          <p className="mt-3 truncate font-medium text-[#17202e]">{recipientName(s)}</p><p className="mt-1 truncate text-sm text-[#545e6e]">{caregiverName(s)}</p><p className="mt-3 text-xs text-[#808894]">{fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}</p>
        </button>)}</div>:<div className="p-5"><EmptyState title="No hay turnos para hoy" description="Los turnos programados aparecerán aquí."/></div>}
      </Panel>

      <Panel className="xl:col-span-5"><PanelTitle title="Personal" sub="Acceso rápido a Workforce"/>
        <div className="p-5 sm:p-6"><div className="flex items-center gap-4 rounded-2xl bg-[#faf8f3] p-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#e4ece2] text-[#567a60]"><Users size={20}/></span><div className="min-w-0 flex-1"><p className="font-medium text-[#17202e]">{covered} asignaciones cubiertas hoy</p><p className="text-sm text-[#545e6e]">{unassigned.length?String(unassigned.length)+" necesitan personal":"Sin brechas de cobertura"}</p></div></div>
          <button onClick={()=>navigate("/agency/workers")} className="mt-4 flex w-full items-center justify-between text-sm font-medium text-[#13294b]"><span>Ver todo el personal</span><ArrowRight size={16}/></button></div>
      </Panel>

      <Panel className="xl:col-span-7"><PanelTitle title="Actividad reciente" sub="Registros de cuidado de hoy"/>
        {recent.length?<ul className="mt-3 divide-y divide-[#e5dfd2] border-t border-[#e5dfd2]">{recent.map(e=><li key={e.id} className="px-5 py-3.5 sm:px-6"><div className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#567a60]"/><div className="min-w-0"><p className="text-sm font-medium text-[#17202e]">{eventLabel[e.event_type]??"Registro de cuidado"}</p>{eventDetail(e)&&<p className="mt-0.5 truncate text-sm text-[#545e6e]">{eventDetail(e)}</p>}<p className="mt-1 text-xs text-[#808894]">{new Intl.DateTimeFormat("es-PR",{hour:"numeric",minute:"2-digit"}).format(new Date(e.occurred_at))}</p></div></div></li>)}</ul>:<div className="p-5"><EmptyState title="Sin actividad reciente" description="Los registros de cuidado de hoy aparecerán aquí."/></div>}
      </Panel>

      <div className="grid grid-cols-2 gap-3 xl:col-span-12 sm:grid-cols-4">
        {[["Crear turno",CalendarPlus,"/agency/shifts?create=1"],["Personal",UserPlus,"/agency/workers"],["Residentes",Users,"/agency/residents"],["Incidentes",AlertTriangle,"/agency/incidents"]].map(([label,Icon,to])=><button key={String(label)} onClick={()=>navigate(String(to))} className="flex min-h-24 flex-col justify-between rounded-[18px] border border-[#e5dfd2] bg-white p-4 text-left shadow-[0_8px_24px_rgba(19,41,75,.04)] transition hover:-translate-y-0.5"><Icon size={19} className="text-[#567a60]"/><span className="text-sm font-medium text-[#17202e]">{String(label)}</span></button>)}
      </div>
    </div>
  </div>;
}
