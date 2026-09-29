import { useState, type ReactNode } from "react";
import { Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Users, UserCog, CalendarRange, AlertTriangle, BadgeCheck, Bot, MessageCircle, ShieldCheck, Settings, TrendingUp, DollarSign, Siren, ClipboardCheck, Menu, X, ChevronDown } from "lucide-react";
import { Avatar, IconButton, NavigationItem } from "@/components/ui";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useAuth } from "@/auth/AuthProvider";

type NavItem={to:string;icon:ReactNode;label:string;end?:boolean};
const PRIMARY:NavItem[]=[
 {to:"/agency",end:true,icon:<LayoutDashboard size={18}/>,label:"Resumen"},
 {to:"/agency/residents",icon:<Users size={18}/>,label:"Residentes"},
 {to:"/agency/workers",icon:<UserCog size={18}/>,label:"Personal"},
 {to:"/agency/shifts",icon:<CalendarRange size={18}/>,label:"Turnos"},
 {to:"/agency/compliance",icon:<ShieldCheck size={18}/>,label:"Cumplimiento"},
 {to:"/agency/messages",icon:<MessageCircle size={18}/>,label:"Mensajes"},
];
const OPERATIONS:NavItem[]=[
 {to:"/agency/planning",icon:<TrendingUp size={18}/>,label:"Planificación"},
 {to:"/agency/timesheets",icon:<DollarSign size={18}/>,label:"Horas y facturación"},
 {to:"/agency/operations",icon:<Siren size={18}/>,label:"Centro operacional"},
 {to:"/agency/quality",icon:<ClipboardCheck size={18}/>,label:"Calidad"},
 {to:"/agency/incidents",icon:<AlertTriangle size={18}/>,label:"Incidentes"},
];
const TOOLS:NavItem[]=[{to:"/agency/agents",icon:<Bot size={18}/>,label:"Centro de agentes"},{to:"/agency/settings",icon:<Settings size={18}/>,label:"Configuración"}];
function Group({label,items,defaultOpen=false}:{label:string;items:NavItem[];defaultOpen?:boolean}){const[open,setOpen]=useState(defaultOpen);return <div className="mt-2"><button type="button" onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[var(--text-caption)] font-semibold uppercase tracking-wide text-white/65 hover:bg-white/5"><span>{label}</span><ChevronDown size={15} className={`transition-transform ${open?"rotate-180":""}`}/></button>{open&&<div className="mt-1 flex flex-col gap-1">{items.map(item=><NavigationItem key={item.to} {...item}/>)}</div>}</div>}
function SidebarContent({onNavigate}:{onNavigate?:()=>void}){const{activeOrganization,isPlatformAdmin}=useAuth();const organizationName=activeOrganization?.name??"Organización";return <div className="flex h-full flex-col pb-[env(safe-area-inset-bottom)]"><Link to="/agency" className="flex h-16 items-center gap-2 px-3"><span className="font-display text-[var(--text-h3)] text-white">ETNARA</span><span className="text-[var(--text-caption)] font-medium uppercase tracking-wide text-white/60">Agencia</span></Link><nav className="flex-1 overflow-y-auto px-2 pb-3" onClick={onNavigate}>{isPlatformAdmin&&<NavigationItem to="/platform" icon={<BadgeCheck size={18}/>} label="Plataforma"/>}<div className="flex flex-col gap-1">{PRIMARY.map(item=><NavigationItem key={item.to} {...item}/>)}</div><Group label="Operaciones" items={OPERATIONS}/><Group label="Administración" items={TOOLS}/></nav><div className="border-t border-white/10 p-3"><div className="flex items-center gap-2.5"><Avatar name={organizationName} size={36}/><div className="min-w-0"><p className="truncate text-[var(--text-small)] font-medium text-white">{organizationName}</p><p className="truncate text-[var(--text-caption)] text-white/70">Organización activa</p></div></div></div></div>}
export function AgencyLayout(){const[drawerOpen,setDrawerOpen]=useState(false);const{activeOrganization,user}=useAuth();return <div className="min-h-dvh bg-[var(--color-bg)] md:flex"><aside className="hidden w-64 shrink-0 bg-[var(--color-navy-950)] md:block"><div className="fixed h-dvh w-64"><SidebarContent/></div></aside>{drawerOpen&&<div className="fixed inset-0 z-[var(--z-overlay)] md:hidden"><div className="absolute inset-0 bg-black/40" onClick={()=>setDrawerOpen(false)} aria-hidden/><div className="absolute left-0 top-0 h-full w-[min(88vw,18rem)] bg-[var(--color-navy-950)] shadow-xl"><SidebarContent onNavigate={()=>setDrawerOpen(false)}/></div></div>}<div className="min-w-0 flex-1"><header className="sticky top-0 z-[var(--z-header)] flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--spacing-md)]"><div className="flex min-w-0 items-center gap-3"><IconButton icon={drawerOpen?<X size={20}/>:<Menu size={20}/>} label={drawerOpen?"Cerrar menú":"Abrir menú"} className="md:hidden" onClick={()=>setDrawerOpen(v=>!v)}/><div className="min-w-0"><p className="truncate text-[var(--text-small)] font-medium text-[var(--color-text-primary)] md:text-[var(--text-body)]">{activeOrganization?.name??"Organización"}</p><p className="hidden text-[var(--text-caption)] text-[var(--color-text-muted)] sm:block">Espacio administrativo</p></div></div><div className="flex items-center gap-3"><NotificationBell/><Avatar name={user?.email??"Administrador"} size={32}/></div></header><main className="mx-auto max-w-[1200px] p-[var(--spacing-md)] md:p-[var(--spacing-lg)]"><Outlet/></main></div></div>}
