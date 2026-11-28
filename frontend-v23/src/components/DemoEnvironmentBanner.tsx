import { useAuth } from "@/auth/AuthProvider";
import { useTranslation } from "react-i18next";
import { isDemoEnvironment } from "@/features/residential/modality";

/** 170 · D9: franja fija de «Entorno de demostración». Sin el interruptor DEMO_ENVIRONMENT no se dibuja nada. */
export function DemoEnvironmentBanner() {
  const { activeOrganization } = useAuth();
  const { t } = useTranslation("residential"); // F0.1: español e inglés
  if (!isDemoEnvironment(activeOrganization?.features)) return null;
  return (
    <div role="status" data-testid="demo-environment-banner"
      className="sticky top-0 z-50 w-full bg-[var(--color-warning-700)] px-4 py-1.5 text-center text-[var(--text-small)] font-semibold text-white">
      {t("demoBanner")}
    </div>
  );
}
