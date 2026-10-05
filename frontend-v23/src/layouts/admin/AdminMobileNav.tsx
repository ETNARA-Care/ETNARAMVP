import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, X } from "lucide-react";
import type { AdminNavGroup, AdminNavItem } from "./adminNav";

const isActivePath = (pathname: string, item: AdminNavItem) =>
 item.end ? pathname === item.to || pathname === `${item.to}/` : pathname === item.to || pathname.startsWith(`${item.to}/`);

/** Barra inferior (Inicio, Compliance, Turnos, Residentes, Más) + hoja con todas las secciones. */
export function AdminMobileNav({ tabs, groups, platformLink }: { tabs: AdminNavItem[]; groups: AdminNavGroup[]; platformLink: ReactNode }) {
 const [sheet, setSheet] = useState(false);
 const { pathname } = useLocation();
 useEffect(() => { document.body.style.overflow = sheet ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [sheet]);
 const inMore = !tabs.some((t) => isActivePath(pathname, t));

 return (
 <>
 <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden">
 <ul className="mx-auto grid w-full max-w-[32rem] grid-cols-5">
 {tabs.map((t) => (
 <li key={t.to} className="min-w-0">
 <NavLink to={t.to} end={t.end} className={({ isActive }) => `relative flex w-full flex-col items-center gap-1 pb-2 pt-2.5 text-[0.6875rem] ${isActive ? "font-medium text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
 {({ isActive }) => (<>
 {isActive && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[var(--color-success-700)]" aria-hidden />}
 <t.icon size={21} strokeWidth={isActive ? 2 : 1.6} aria-hidden />
 <span className="max-w-full truncate px-1">{t.label}</span>
 </>)}
 </NavLink>
 </li>
 ))}
 <li className="min-w-0">
 <button type="button" onClick={() => setSheet(true)} aria-expanded={sheet} className={`relative flex w-full flex-col items-center gap-1 pb-2 pt-2.5 text-[0.6875rem] ${inMore ? "font-medium text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`}>
 {inMore && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[var(--color-success-700)]" aria-hidden />}
 <MoreHorizontal size={21} strokeWidth={1.6} aria-hidden />Más
 </button>
 </li>
 </ul>
 </nav>

 {sheet && (
 <div className="fixed inset-0 z-[var(--z-modal)] lg:hidden" role="dialog" aria-modal="true" aria-label="Todas las secciones">
 <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-[var(--color-navy-950)]/50" onClick={() => setSheet(false)} />
 <div className="admin-enter absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[24px] bg-[var(--color-surface)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-3">
 <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-text-primary)]/15" aria-hidden />
 <div className="mb-2 flex items-center justify-between px-2">
 <p className="font-display text-xl text-[var(--color-text-primary)]">Todas las secciones</p>
 <button type="button" onClick={() => setSheet(false)} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-text-primary)]/5 text-[var(--color-text-secondary)]"><X size={17} /></button>
 </div>
 {platformLink && <div className="mt-3 rounded-[12px] bg-[var(--color-navy-950)] p-1.5">{platformLink}</div>}
 {groups.map((g) => (
 <div key={g.label} className="mt-4">
 <p className="px-2 pb-1.5 text-xs text-[var(--color-text-muted)]">{g.label}</p>
 <div className="grid grid-cols-2 gap-2">
 {g.items.map((i) => (
 <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setSheet(false)} className={({ isActive }) => `flex min-h-12 min-w-0 items-center gap-3 rounded-[12px] border px-3.5 py-2.5 text-sm ${isActive ? "border-[var(--color-navy-900)]/30 bg-[var(--color-navy-900)]/[0.06] text-[var(--color-text-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}>
 <i.icon size={18} strokeWidth={1.75} className="shrink-0" aria-hidden />
 <span className="min-w-0 leading-tight">{i.label}</span>
 </NavLink>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 );
}
