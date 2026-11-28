import { useAuth } from "@/auth/AuthProvider";
import { useTranslation } from "react-i18next";
import { isDemoEnvironment } from "@/features/residential/modality";

/**
 * 170 · D9: franja fija de «Entorno de demostración». Sin el interruptor DEMO_ENVIRONMENT no se dibuja nada.
 * 28-nov: altura fija (--demo-banner-h, una sola línea) para que las barras fijas de cada portal se coloquen justo debajo
 * y no la tapen ni queden tapadas al desplazarse (tokens.css activa la variable solo cuando la franja existe).
 */
export function DemoEnvironmentBanner() {
  const { activeOrganization } = useAuth();
  const { t } = useTranslation("residential"); // F0.1: español e inglés
  if (!isDemoEnvironment(activeOrganization?.features)) return null;
  return (
    <div role="status" data-testid="demo-environment-banner" data-demo-banner
      className="sticky top-0 z-[calc(var(--z-header)+1)] flex h-[var(--demo-banner-h)] w-full items-center justify-center bg-[var(--color-warning-700)] px-4 text-[var(--text-small)] font-semibold text-white">
      <span className="truncate">{t("demoBanner")}</span>
    </div>
  );
}
