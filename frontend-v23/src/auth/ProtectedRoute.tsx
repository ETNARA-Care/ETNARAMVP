import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { bootstrapErrorMessage } from "./errorMessages";

/**
 * Nunca deja pasar a una ruta privada mientras status === "loading" -- ese
 * es exactamente el bootstrap de sesión (comprobar token -> GET /me).
 * Una persona no autenticada que abra /caregiver, /family o /agency
 * directamente termina en /login.
 */
export function ProtectedRoute() {
  const { status, error } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--color-navy-800)] border-t-transparent animate-spin" aria-label="Cargando sesión" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-dvh flex items-center justify-center px-[var(--spacing-md)] text-center">
        <p className="text-[var(--color-text-secondary)]">
          {error ? bootstrapErrorMessage(error) : "No pudimos recuperar tu sesión."}
        </p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
