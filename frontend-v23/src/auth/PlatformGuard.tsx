import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function PlatformGuard({ children }: { children: ReactNode }) {
  const { isPlatformAdmin } = useAuth();
  if (!isPlatformAdmin) return <Navigate to="/" replace />;
  return children;
}
