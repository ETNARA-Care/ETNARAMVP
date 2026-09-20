import { Link, Outlet } from "react-router-dom";
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, IconButton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";

export function PlatformLayout() {
  const { user, activeOrganization, logout } = useAuth();
  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <header className="sticky top-0 z-[var(--z-header)] bg-[var(--color-navy-950)] text-white">
        <div className="max-w-[1200px] mx-auto h-16 px-[var(--spacing-md)] flex items-center justify-between gap-3">
          <Link to="/platform" className="flex items-center gap-2">
            <ShieldCheck size={20} aria-hidden />
            <span className="font-display text-[var(--text-h3)]">ETNARA</span>
            <span className="text-[var(--text-caption)] text-white/70 uppercase tracking-wide">Plataforma</span>
          </Link>
          <div className="flex items-center gap-2">
            {activeOrganization && (
              <Link
                to="/agency"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] border border-white/30 px-3 text-[var(--text-small)] font-medium hover:bg-white/10"
              >
                <ArrowLeft size={16} aria-hidden />
                Agencia
              </Link>
            )}
            <Avatar name={user?.email ?? "ETNARA"} size={32} />
            <IconButton
              icon={<LogOut size={18} />}
              label="Cerrar sesión"
              className="text-white hover:bg-white/10"
              onClick={() => void logout()}
            />
          </div>
        </div>
      </header>
      <main className="p-[var(--spacing-md)] md:p-[var(--spacing-lg)] max-w-[1200px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
