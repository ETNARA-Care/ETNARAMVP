import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface NavigationItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
  badge?: number;
}

/** Uso en sidebar de escritorio (Agencia): icono + etiqueta en línea. */
export function NavigationItem({ to, icon, label, end, badge }: NavigationItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 h-11 px-3 rounded-[var(--radius-sm)] text-[var(--text-body)] font-medium transition-colors
        ${isActive
          ? "bg-[var(--color-navy-800)] text-white"
          : "text-[var(--color-ivory-100)]/80 hover:bg-white/10 hover:text-white"}`
      }
    >
      <span aria-hidden>{icon}</span>
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="text-[var(--text-caption)] font-semibold bg-[var(--color-danger-700)] text-white rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

/** Uso en barra inferior móvil (Familiar / Cuidador): icono arriba, etiqueta abajo. */
export function BottomNavItem({ to, icon, label, end, badge }: NavigationItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-1 flex-col items-center justify-center gap-0.5 h-full text-[var(--text-caption)] font-medium
        ${isActive ? "text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`
      }
    >
      <span aria-hidden>{icon}</span>
      {label}
      {!!badge && (
        <span className="absolute top-1.5 right-[28%] h-2 w-2 rounded-full bg-[var(--color-danger-700)]" aria-hidden />
      )}
    </NavLink>
  );
}
