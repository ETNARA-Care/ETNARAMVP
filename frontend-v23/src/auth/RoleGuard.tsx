import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { resolveExperienceRoute, type ExperienceRoute } from "./roles";

/**
 * Se usa DENTRO de <ProtectedRoute> (ya garantiza status === "authenticated").
 * La autoridad interna de Plataforma es una experiencia separada: una sesión
 * de platform admin nunca entra en Agency/Family/Caregiver aunque también
 * exista una membresía organizacional histórica o de demo.
 */
export function RoleGuard({ experience, children }: { experience: ExperienceRoute; children: ReactNode }) {
  const { organizations, activeOrganization, roles, isPlatformAdmin } = useAuth();

  if (isPlatformAdmin) {
    return <Navigate to="/platform" replace />;
  }

  if (organizations.length > 1 && !activeOrganization) {
    return <Navigate to="/select-organization" replace />;
  }

  const resolved = resolveExperienceRoute(roles);
  if (resolved !== experience) {
    return <Navigate to={resolved ?? "/login"} replace />;
  }

  return <>{children}</>;
}
