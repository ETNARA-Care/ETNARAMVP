import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function TopNav() {
  const { activeOrganization, organizations, setActiveOrganizationId, logout } = useAuth();
  const location = useLocation();
  const roles = activeOrganization?.roles ?? [];
  const isFamily = roles.includes("FAMILY");
  const isManager = roles.includes("ORGANIZATION_ADMIN") || roles.includes("SUPERVISOR");
  const isCaregiver = !isManager && !isFamily;

  const links: Array<{ to: string; label: string }> = [];
  if (isManager) {
    links.push({ to: "/agency", label: "Panel" });
    links.push({ to: "/agency/turnos", label: "Turnos" });
    links.push({ to: "/agency/personas", label: "Personas" });
    links.push({ to: "/agency/equipo", label: "Equipo" });
  }
  if (isFamily) {
    links.push({ to: "/family", label: "Inicio" });
  }
  if (isCaregiver) {
    links.push({ to: "/caregiver", label: "Mis turnos" });
  }
  links.push({ to: "/messages", label: "Mensajes" });
  links.push({ to: "/notifications", label: "Notificaciones" });

  function isActive(to: string) {
    if (to === "/agency") return location.pathname === "/agency";
    return location.pathname.startsWith(to);
  }

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--color-ink)" }}>ETNARA Care</span>
        <ul style={{ display: "flex", gap: 4, listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}>
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                aria-current={isActive(l.to) ? "page" : undefined}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--fs-body)",
                  color: isActive(l.to) ? "var(--color-ink)" : "var(--color-ink-soft)",
                  fontWeight: isActive(l.to) ? 600 : 400,
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  background: isActive(l.to) ? "var(--color-ink-tint)" : "transparent",
                  display: "block",
                }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {organizations.length > 1 && (
          <select
            aria-label="Organización activa"
            value={activeOrganization?.id ?? ""}
            onChange={(e) => setActiveOrganizationId(e.target.value)}
            style={{ fontFamily: "var(--font-body)", fontSize: "var(--fs-caption)", padding: "4px 8px", borderRadius: 6 }}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => logout()}
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-caption)",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "6px 12px",
            cursor: "pointer",
            color: "var(--color-ink-soft)",
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
