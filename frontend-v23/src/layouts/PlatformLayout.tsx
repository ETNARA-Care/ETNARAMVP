import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, Building2, FileCheck2, LayoutDashboard, LogOut, RadioTower } from "lucide-react";
import { Avatar, IconButton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";

const NAV = [
  { to: "/platform", end: true, icon: LayoutDashboard, label: "Resumen", short: "Resumen" },
  { to: "/platform/organizations", end: false, icon: Building2, label: "Organizaciones", short: "Clientes" },
  { to: "/platform/credentials", end: false, icon: FileCheck2, label: "Verificación", short: "Verificar" },
  { to: "/platform/tower", end: false, icon: RadioTower, label: "ETNARA Tower", short: "Tower" },
] as const;

// Tablet / desktop: tabs under the header (unchanged).
const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex shrink-0 min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[length:1rem] font-medium transition-colors ${isActive ? "border-[var(--color-sage-300)] text-white" : "border-transparent text-white/65 hover:text-white"}`;

// Phones: bottom bar within thumb reach, so the header stays one compact line.
const bottomNavClass = ({ isActive }: { isActive: boolean }) =>
  `group flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[length:0.6875rem] font-semibold tracking-[.01em] transition-colors ${isActive ? "text-white" : "text-white/60 active:text-white"}`;

export function PlatformLayout() {
  const { user, activeOrganization, logout } = useAuth();

  return (
    <div data-portal="platform" className="min-h-dvh min-w-0 overflow-x-clip bg-[var(--color-bg)]">
      <header className="sticky top-0 z-[var(--z-header)] bg-[var(--color-navy-950)] pt-[env(safe-area-inset-top)] text-white shadow-sm">
        <div className="mx-auto flex min-h-14 w-full min-w-0 max-w-[1280px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-[var(--spacing-md)] md:min-h-[72px]">
          <Link to="/platform" className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3" aria-label="ETNARA Centro Administrativo">
            <img src="/etnara-mark.svg" alt="" className="h-8 w-8 shrink-0 rounded-[9px] md:h-10 md:w-10 md:rounded-[10px]" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[length:1.0625rem] leading-none md:text-[length:1rem]">ETNARA</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-sage-300)] sm:inline">Plataforma</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-white/60 md:mt-1">Centro Administrativo</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {activeOrganization && (
              <Link to="/agency" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-white/20 px-2.5 text-[length:1rem] font-medium text-white/80 hover:bg-white/10 sm:px-3">
                <ArrowLeft size={16} /> <span className="hidden sm:inline">Organización</span>
              </Link>
            )}
            <span className="hidden sm:inline-flex"><Avatar name={user?.email ?? "ETNARA"} size={32} /></span>
            <IconButton icon={<LogOut size={18} />} label="Cerrar sesión" className="text-white hover:bg-white/10" onClick={() => void logout()} />
          </div>
        </div>

        <nav className="mx-auto hidden w-full min-w-0 max-w-[1280px] gap-1 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:thin] sm:px-[var(--spacing-md)] md:flex" aria-label="Centro Administrativo ETNARA">
          {NAV.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={navClass}><Icon size={16} />{label}</NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1280px] overflow-x-clip px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-[var(--spacing-md)] md:p-[var(--spacing-lg)]">
        <Outlet />
      </main>

      <nav data-ui="platform-bottom-nav" aria-label="Centro Administrativo ETNARA"
        className="fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-white/10 bg-[var(--color-navy-950)]/95 px-2 pt-1.5 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(12,24,48,.18)] backdrop-blur md:hidden">
        <div className="mx-auto grid w-full max-w-[28rem] grid-cols-4 gap-1">
          {NAV.map(({ to, end, icon: Icon, short }) => (
            <NavLink key={to} to={to} end={end} className={bottomNavClass}>
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? "bg-[var(--color-sage-300)]/20 text-[var(--color-sage-300)]" : ""}`}><Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} /></span>
                  <span className="max-w-full truncate">{short}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
