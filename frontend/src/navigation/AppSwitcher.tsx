import { NavLink } from "react-router-dom";

const apps = [
  { to: "/family", label: "App Familiar" },
  { to: "/caregiver", label: "App Cuidador" },
  { to: "/agency", label: "Portal Agencia" },
];

/**
 * Only present in this prototype to let one person navigate between the
 * three surfaces during a demo -- in the real product each app is its own
 * entry point (mobile app / mobile app / web portal), a person never sees
 * this switcher.
 */
export function AppSwitcher() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        padding: "10px 8px",
        background: "var(--color-ink)",
        flexWrap: "wrap",
      }}
    >
      {apps.map((a) => (
        <NavLink
          key={a.to}
          to={a.to}
          style={({ isActive }) => ({
            padding: "6px 14px",
            borderRadius: "var(--radius-full)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            background: isActive ? "white" : "transparent",
            color: isActive ? "var(--color-ink)" : "#cfe0ee",
          })}
        >
          {a.label}
        </NavLink>
      ))}
    </div>
  );
}
