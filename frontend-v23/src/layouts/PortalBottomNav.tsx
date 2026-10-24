import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

/**
 * Barra inferior única para los tres portales (Administrativo, Cuidador y
 * Familiar), con las medidas del portal Administrativo: iconos de 21 px,
 * texto de 11 px, línea salvia arriba de la pestaña activa, fondo translúcido
 * y el área segura inferior de Safari (env(safe-area-inset-bottom)).
 *
 * `hideFrom="lg"` la oculta en escritorio cuando hay barra lateral (Administrativo).
 */
export interface PortalTab {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}
export interface PortalTabButton {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active: boolean;
  expanded?: boolean;
}

const itemClass = (active: boolean) =>
  `relative flex w-full flex-col items-center gap-1 pb-2 pt-2.5 text-[0.6875rem] ${active ? "font-medium text-[var(--color-navy-900)]" : "text-[var(--color-text-muted)]"}`;

function ActiveMark({ on }: { on: boolean }) {
  return on ? <span data-active-mark className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[var(--color-success-700)]" aria-hidden /> : null;
}

export function PortalBottomNav({ tabs, button, hideFrom }: { tabs: PortalTab[]; button?: PortalTabButton; hideFrom?: "lg" }) {
  const count = tabs.length + (button ? 1 : 0);
  return (
    <nav
      aria-label="Navegación principal"
      data-portal-nav
      className={`fixed inset-x-0 bottom-0 z-[var(--z-nav)] border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md ${hideFrom === "lg" ? "lg:hidden" : ""}`}
    >
      <ul className="mx-auto grid w-full max-w-[32rem]" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <li key={t.to} className="min-w-0">
            <NavLink to={t.to} end={t.end} className={({ isActive }) => itemClass(isActive)}>
              {({ isActive }) => (<>
                <ActiveMark on={isActive} />
                <t.icon size={21} strokeWidth={isActive ? 2 : 1.6} aria-hidden />
                <span className="max-w-full truncate px-1">{t.label}</span>
              </>)}
            </NavLink>
          </li>
        ))}
        {button && (
          <li className="min-w-0">
            <button type="button" onClick={button.onClick} aria-expanded={button.expanded} className={itemClass(button.active)}>
              <ActiveMark on={button.active} />
              <button.icon size={21} strokeWidth={button.active ? 2 : 1.6} aria-hidden />
              <span className="max-w-full truncate px-1">{button.label}</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
