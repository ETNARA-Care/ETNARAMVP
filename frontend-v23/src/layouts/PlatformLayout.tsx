import { Link, NavLink, Outlet } from "react-router-dom";
import { Building2, FileCheck2, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, IconButton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";

export function PlatformLayout(){
  const { user, logout } = useAuth();
  return <div className="min-h-dvh bg-[var(--color-bg)]">
    <header className="sticky top-0 z-[var(--z-header)] bg-[var(--color-navy-950)] text-white">
      <div className="max-w-[1200px] mx-auto h-16 px-[var(--spacing-md)] flex items-center justify-between gap-3">
        <Link to="/platform" className="flex items-center gap-2"><ShieldCheck size={20}/><span className="font-display text-[var(--text-h3)]">ETNARA</span><span className="text-[var(--text-caption)] text-white/70 uppercase tracking-wide">Plataforma</span></Link>
        <div className="flex items-center gap-2"><Avatar name={user?.email??"ETNARA"} size={32}/><IconButton icon={<LogOut size={18}/>} label="Cerrar sesión" className="text-white hover:bg-white/10" onClick={()=>void logout()}/></div>
      </div>
      <nav className="max-w-[1200px] mx-auto px-[var(--spacing-md)] flex gap-1" aria-label="Plataforma"><NavLink to="/platform/organizations" className={({isActive})=>`inline-flex items-center gap-2 px-3 py-2 text-[var(--text-small)] border-b-2 ${isActive?"border-white text-white":"border-transparent text-white/70 hover:text-white"}`}><Building2 size={16}/>Organizaciones</NavLink><NavLink to="/platform/credentials" className={({isActive})=>`inline-flex items-center gap-2 px-3 py-2 text-[var(--text-small)] border-b-2 ${isActive?"border-white text-white":"border-transparent text-white/70 hover:text-white"}`}><FileCheck2 size={16}/>Credenciales</NavLink></nav>
    </header>
    <main className="p-[var(--spacing-md)] md:p-[var(--spacing-lg)] max-w-[1200px] mx-auto"><Outlet/></main>
  </div>
}
