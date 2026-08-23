import { NavLink } from "react-router-dom";
import { HomeIcon, HistoryIcon, MessageIcon, ShieldIcon, UsersIcon } from "../components/icons";

const tabs = [
  { to: "/family", label: "Hoy", Icon: HomeIcon, end: true },
  { to: "/family/historial", label: "Historial", Icon: HistoryIcon },
  { to: "/family/mensajes", label: "Mensajes", Icon: MessageIcon },
  { to: "/family/confianza", label: "Confianza", Icon: ShieldIcon },
  { to: "/family/perfil", label: "Perfil", Icon: UsersIcon },
];

export function FamilyTabBar() {
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        padding: "6px 4px calc(env(safe-area-inset-bottom, 0px) + 6px)",
      }}
    >
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: "6px 2px",
            textDecoration: "none",
            color: isActive ? "var(--color-ink)" : "var(--color-ink-soft)",
            minHeight: "var(--tap-min)",
          })}
        >
          <Icon size={20} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
