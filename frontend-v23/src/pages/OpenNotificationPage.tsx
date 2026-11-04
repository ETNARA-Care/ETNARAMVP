import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { resolveExperienceRoute } from "@/auth/roles";
import { pushApi } from "@/api/push";
import { markNotificationRead } from "@/api/notifications";
import { isSafeInternalPath, parseOpenParam } from "@/features/push/pushSupport";
import { clearPendingOpen, readPendingOpen, savePendingOpen } from "@/features/push/pendingOpen";

/**
 * /abrir?n=<id del aviso> — adonde lleva una notificación push.
 * 1. Sin sesión: guarda el id (solo en esta pestaña) y pide iniciar sesión (decisión 5).
 * 2. Con sesión: el SERVIDOR decide el destino según el rol y los permisos de AHORA
 *    (GET /me/notifications/:id/target). Si ya no hay acceso, abre la bandeja.
 * El aviso no lleva datos: aquí solo llega un id opaco.
 */
export function OpenNotificationPage() {
  const { status, roles, isPlatformAdmin, activeOrganization, setActiveOrganization } = useAuth();
  const { t } = useTranslation("common");
  const location = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    const fromUrl = parseOpenParam(location.search);
    if (fromUrl) savePendingOpen(fromUrl);
    if (status === "loading") return;
    if (status !== "authenticated") { navigate("/login", { replace: true }); return; }
    if (started.current) return;
    started.current = true;
    const id = fromUrl ?? readPendingOpen();
    clearPendingOpen();
    const token = getToken();
    const inbox = () => {
      const home = resolveExperienceRoute(roles, isPlatformAdmin) ?? "/";
      navigate(home === "/family" ? "/family/notifications" : home, { replace: true });
    };
    if (!id || !token) { inbox(); return; }
    void (async () => {
      try {
        const target = await pushApi.target(id, token);
        await markNotificationRead(id, token).catch(() => undefined);
        if (!isSafeInternalPath(target.path)) { inbox(); return; }
        if (target.organizationId && activeOrganization?.id !== target.organizationId) await setActiveOrganization(target.organizationId);
        navigate(target.path, { replace: true });
      } catch {
        inbox();
      }
    })();
  }, [status, location.search, navigate, roles, isPlatformAdmin, activeOrganization, setActiveOrganization]);

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-navy-800)] border-t-transparent animate-spin" aria-label={t("push.opening")} />
    </div>
  );
}
