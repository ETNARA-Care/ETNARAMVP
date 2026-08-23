import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { LoadingState } from "../components/UiStates";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <LoadingState label="Verificando sesión..." />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function roleHome(roles: string[]): string {
  if (roles.includes("FAMILY")) return "/family";
  if (roles.includes("ORGANIZATION_ADMIN") || roles.includes("SUPERVISOR")) return "/agency";
  return "/caregiver";
}
