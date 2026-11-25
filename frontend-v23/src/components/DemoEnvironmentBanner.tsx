import { useAuth } from "@/auth/AuthProvider";
import { DEMO_ENVIRONMENT_NOTICE, isDemoEnvironment } from "@/features/residential/modality";

/** 170 · D9: franja fija de «Entorno de demostración». Sin el interruptor DEMO_ENVIRONMENT no se dibuja nada. */
export function DemoEnvironmentBanner() {
  const { activeOrganization } = useAuth();
  if (!isDemoEnvironment(activeOrganization?.features)) return null;
  return (
    <div role="status" data-testid="demo-environment-banner"
      className="sticky top-0 z-50 w-full bg-[var(--color-warning-700)] px-4 py-1.5 text-center text-[var(--text-small)] font-semibold text-white">
      {DEMO_ENVIRONMENT_NOTICE}
    </div>
  );
}
