import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { getAgencyPhotoMode, type AgencyPhotoMode } from "@/api/activityPhotos";
import { canManageLegalHolds, canReviewPhotos } from "./permissions";

/**
 * 145 (§5): qué pantalla de fotos ve esta persona en esta agencia.
 *  - Administración o supervisión → siempre se pregunta al backend: los interruptores guardados al
 *    iniciar sesión pueden estar desactualizados (Central apaga el módulo) y la página no debe pedir
 *    imágenes en modo «full» si el backend ya está en modo de revisión legal.
 *  - Cualquier otro rol → "off" (sin petición).
 * Mientras se pregunta: "loading". El backend vuelve a decidir en cada petición.
 */
export function usePhotoMode(): AgencyPhotoMode | "loading" {
  const { activeOrganization, roles } = useAuth();
  const organizationId = activeOrganization?.id;
  // Sin rol de gestión: nunca hay pantalla de fotos (ni con el módulo encendido ni en revisión legal).
  const on = hasOrgFeature(activeOrganization?.features, "ACTIVITY_PHOTOS");
  const local: AgencyPhotoMode | null = canReviewPhotos(roles) && (on || canManageLegalHolds(roles)) ? null : "off";
  const [asked, setAsked] = useState<{ key: string; mode: AgencyPhotoMode } | null>(null);
  const key = `${organizationId ?? ""}`;
  useEffect(() => {
    if (local !== null || !organizationId) return;
    const token = getToken();
    if (!token) return;
    let alive = true;
    getAgencyPhotoMode(organizationId, token)
      .then((mode) => { if (alive) setAsked({ key: organizationId, mode }); })
      .catch(() => { if (alive) setAsked({ key: organizationId, mode: "off" }); });
    return () => { alive = false; };
  }, [local, organizationId]);
  if (local !== null) return local;
  return asked && asked.key === key ? asked.mode : "loading";
}
