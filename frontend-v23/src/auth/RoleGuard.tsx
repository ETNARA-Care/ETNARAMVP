import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { resolveExperienceRoute, type ExperienceRoute } from "./roles";

/**
 * Se usa DENTRO de <ProtectedRoute> (ya garantiza status === "authenticated").
 * Si hay más de una organización y ninguna activa todavía, manda a elegir.
 * Si la organización activa no tiene el rol correspondiente a esta
 * experiencia, redirige a la que sí le corresponde según roles.ts --
 * nunca deja a alguien "atascado" viendo una experiencia sin permiso real.
 */
export function RoleGuard({ experience, children }: { experience: ExperienceRoute; children: ReactNode }) {
  const { organizations, activeOrganization, roles } = useAuth();

  if (organizations.length > 1 && !activeOrganization) {
    return <Navigate to="/select-organization" replace />;
  }

  const resolved = resolveExperienceRoute(roles);
  if (resolved !== experience) {
    return <Navigate to={resolved ?? "/login"} replace />;
  }

  return <>{children}</>;
}
