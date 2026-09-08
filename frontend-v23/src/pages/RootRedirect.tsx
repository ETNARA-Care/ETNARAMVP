import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { resolveExperienceRoute } from "@/auth/roles";

/**
 * "/" ya no es la landing de desarrollo -- con auth real, la raíz decide
 * a dónde mandar a la persona según su sesión real:
 *   - sin sesión -> /login
 *   - sesión con >1 organización sin elegir -> /select-organization
 *   - sesión resuelta -> la experiencia que le corresponde por rol real
 * DemoLandingPage se conserva en /demo únicamente para uso interno de
 * desarrollo (ver App.tsx) -- ya no es alcanzable desde ningún link visible.
 */
export function RootRedirect() {
  const { status, organizations, activeOrganization, roles } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-navy-800)] border-t-transparent animate-spin" aria-label="Cargando sesión" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  if (organizations.length > 1 && !activeOrganization) {
    return <Navigate to="/select-organization" replace />;
  }

  const route = resolveExperienceRoute(roles);
  return <Navigate to={route ?? "/login"} replace />;
}
