import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftRight, Building2, LogOut, Settings } from "lucide-react";
import { Avatar } from "@/components/ui";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { AdminLogo } from "@/components/admin/AdminUI";

function useDismiss(open: boolean, close: () => void) {
 const ref = useRef<HTMLDivElement>(null);
 useEffect(() => {
 if (!open) return;
 const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
 const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
 document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
 return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
 }, [open, close]);
 return ref;
}

export function AdminTopbar({ organizationName, canSwitchOrganization, userLabel, onLogout }: {
 organizationName: string; canSwitchOrganization: boolean; userLabel: string; onLogout: () => Promise<void>;
}) {
 const [menu, setMenu] = useState(false);
 const ref = useDismiss(menu, () => setMenu(false));
 const navigate = useNavigate();
 return (
 <header className="sticky top-0 z-[var(--z-header)] border-b border-[var(--color-border)]/70 bg-[var(--color-bg)]/85 backdrop-blur-md">
 <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-10">
 <Link to="/agency" className="shrink-0 lg:hidden" aria-label="ETNARA Care, ir al resumen"><AdminLogo compact /></Link>
 <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
 <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-success-100)] text-[var(--color-success-700)] sm:grid"><Building2 size={16} aria-hidden /></span>
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{organizationName}</p>
 <p className="hidden truncate text-xs text-[var(--color-text-muted)] sm:block">Espacio administrativo</p>
 </div>
 {canSwitchOrganization && (
 <Link to="/select-organization" className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-text-primary)]/5 hover:text-[var(--color-text-primary)] md:inline-flex">
 <ArrowLeftRight size={14} aria-hidden />Cambiar organización
 </Link>
 )}
 </div>
 <NotificationBell />
 <div ref={ref} className="relative">
 <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu" aria-label="Menú de la cuenta"
 className="flex items-center gap-2.5 rounded-[10px] p-1 hover:bg-[var(--color-text-primary)]/5 xl:pr-2.5">
 <Avatar name={userLabel} size={34} />
 <span className="hidden max-w-[180px] text-left leading-tight xl:block">
 <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">{userLabel}</span>
 <span className="block text-xs text-[var(--color-text-muted)]">Administración</span>
 </span>
 </button>
 {menu && (
 <div role="menu" className="absolute right-0 top-full z-[var(--z-overlay)] mt-2 w-[min(280px,calc(100vw-2rem))] rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-raised)]">
 <p className="truncate px-3 pb-2 pt-2 text-xs text-[var(--color-text-muted)]">{userLabel}</p>
 {canSwitchOrganization && (
 <button role="menuitem" type="button" onClick={() => { setMenu(false); navigate("/select-organization"); }} className="flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm hover:bg-[var(--color-ivory-100)] md:hidden">
 <ArrowLeftRight size={16} aria-hidden />Cambiar organización
 </button>
 )}
 <button role="menuitem" type="button" onClick={() => { setMenu(false); navigate("/agency/settings"); }} className="flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm hover:bg-[var(--color-ivory-100)]">
 <Settings size={16} aria-hidden />Configuración
 </button>
 <button role="menuitem" type="button" onClick={() => { setMenu(false); void onLogout(); }} className="flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm text-[var(--color-danger-700)] hover:bg-[var(--color-danger-100)]">
 <LogOut size={16} aria-hidden />Cerrar sesión
 </button>
 </div>
 )}
 </div>
 </div>
 </header>
 );
}
