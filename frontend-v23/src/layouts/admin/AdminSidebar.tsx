import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { AdminLogo } from "@/components/admin/AdminUI";
import type { AdminNavGroup } from "./adminNav";

/** Enlace del sidebar: indicador salvia a la izquierda cuando está activo. */
export function AdminSideLink({ to, icon: Icon, label, end, onNavigate }: { to: string; icon: LucideIcon; label: string; end?: boolean; onNavigate?: () => void }) {
 return (
 <NavLink to={to} end={end} onClick={onNavigate}
 className={({ isActive }) => `group relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 py-2 text-[0.9rem] transition-colors ${isActive ? "bg-white/[0.08] text-white" : "text-[#DEE4EE]/75 hover:bg-white/[0.04] hover:text-white"}`}>
 {({ isActive }) => (<>
 {isActive && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[var(--color-sage-300)]" aria-hidden />}
 <Icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
 <span className="min-w-0 flex-1 truncate">{label}</span>
 </>)}
 </NavLink>
 );
}

export function AdminSidebar({ groups, platformLink, organizationName }: { groups: AdminNavGroup[]; platformLink: ReactNode; organizationName: string }) {
 return (
 <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col bg-[var(--color-navy-950)] text-[#DEE4EE] lg:flex">
 <Link to="/agency" className="px-6 pb-6 pt-7" aria-label="ETNARA Care, ir al resumen"><AdminLogo inverted /></Link>
 <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3">
 {platformLink && <div className="mb-5">{platformLink}</div>}
 {groups.map((g) => (
 <div key={g.label} className="mb-6">
 <p className="px-3 pb-2 text-xs text-white/45">{g.label}</p>
 <ul className="space-y-0.5">{g.items.map((i) => <li key={i.to}><AdminSideLink {...i} /></li>)}</ul>
 </div>
 ))}
 </nav>
 <div className="m-3 rounded-[12px] border border-white/10 p-4">
 <p className="truncate text-sm text-white">{organizationName}</p>
 <p className="mt-1 text-xs leading-relaxed text-white/60">Organización activa. Sus datos están separados de cualquier otra organización.</p>
 </div>
 </aside>
 );
}
