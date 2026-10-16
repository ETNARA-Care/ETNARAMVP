import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, Building2, FileCheck2, LayoutDashboard, LogOut, RadioTower } from "lucide-react";
import { Avatar, IconButton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex shrink-0 min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[var(--text-small)] font-medium transition-colors ${isActive ? "border-[var(--color-sage-300)] text-white" : "border-transparent text-white/65 hover:text-white"}`;

export function PlatformLayout() {
  const { user, activeOrganization, logout } = useAuth();

  return (
    <div data-portal="platform" className="min-h-dvh min-w-0 overflow-x-clip bg-[var(--color-bg)]">
      <header className="sticky top-0 z-[var(--z-header)] bg-[var(--color-navy-950)] text-white shadow-sm">
        <div className="mx-auto flex min-h-[72px] w-full min-w-0 max-w-[1280px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-[var(--spacing-md)]">
          <Link to="/platform" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" aria-label="ETNARA Centro Administrativo">
            <img src="/etnara-mark.svg" alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[var(--text-h3)] leading-none">ETNARA</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-sage-300)] sm:inline">Plataforma</span>
              </div>
              <p className="mt-1 truncate text-[11px] text-white/60">Centro Administrativo</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {activeOrganization && (
              <Link to="/agency" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-white/20 px-2.5 text-[var(--text-small)] font-medium text-white/80 hover:bg-white/10 sm:px-3">
                <ArrowLeft size={16} /> <span className="hidden sm:inline">Organización</span>
              </Link>
            )}
            <Avatar name={user?.email ?? "ETNARA"} size={32} />
            <IconButton icon={<LogOut size={18} />} label="Cerrar sesión" className="text-white hover:bg-white/10" onClick={() => void logout()} />
          </div>
        </div>

        <nav className="mx-auto flex w-full min-w-0 max-w-[1280px] gap-1 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:thin] sm:px-[var(--spacing-md)] sm:pb-0" aria-label="Centro Administrativo ETNARA">
          <NavLink to="/platform" end className={navClass}><LayoutDashboard size={16} />Resumen</NavLink>
          <NavLink to="/platform/organizations" className={navClass}><Building2 size={16} />Organizaciones</NavLink>
          <NavLink to="/platform/credentials" className={navClass}><FileCheck2 size={16} />Verificación</NavLink>
          <NavLink to="/platform/tower" className={navClass}><RadioTower size={16} />ETNARA Tower</NavLink>
        </nav>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1280px] overflow-x-clip px-4 py-5 pb-24 sm:px-[var(--spacing-md)] md:p-[var(--spacing-lg)]">
        <Outlet />
      </main>
    </div>
  );
}
