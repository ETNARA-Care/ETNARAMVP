import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { getAgencyPhotoMode, type AgencyPhotoMode } from "@/api/activityPhotos";
import { canManageLegalHolds, canReviewPhotos } from "./permissions";

/**
 * 145 (§5): qué pantalla de fotos ve esta persona en esta agencia.
 *  - Módulo encendido + administración o supervisión → "full" (sin petición).
 *  - Módulo apagado + administración → se pregunta al backend: "legal-review" solo si la
 *    agencia tiene fotos con retención legal (revisarlas o levantarlas; nada más).
 *  - Cualquier otro caso → "off" (sin petición).
 * Mientras se pregunta: "loading". El backend vuelve a decidir en cada petición.
 */
export function usePhotoMode(): AgencyPhotoMode | "loading" {
  const { activeOrganization, roles } = useAuth();
  const organizationId = activeOrganization?.id;
  const on = hasOrgFeature(activeOrganization?.features, "ACTIVITY_PHOTOS");
  const local: AgencyPhotoMode | null = on ? (canReviewPhotos(roles) ? "full" : "off") : canManageLegalHolds(roles) ? null : "off";
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
