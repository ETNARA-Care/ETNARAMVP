import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { getResidentialOverview, type ResidentialOverview } from "@/api/residential";
import { isResidentialOrganization } from "@/features/residential/modality";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";

/**
 * 170 (hogares F0): panel base del hogar. Solo administrativo: recuentos y el estado de los módulos de hogar,
 * que nacen apagados y los enciende únicamente ETNARA central. Ningún nombre ni información de salud.
 */
export function ResidentialPanelPage() {
  const { activeOrganization } = useAuth();
  // F0.1: textos en español e inglés (catálogo «residential»).
  const { t } = useTranslation("residential");
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  // A4 (25-nov): los recuentos van ligados a la organización que los pidió; una respuesta atrasada de otra
  // organización se descarta y, al cambiar de organización, nunca se muestran los del hogar anterior.
  const [state, setState] = useState<OrganizationScoped<ResidentialOverview> | null>(null);
  const latest = useRef(createLatestRequest());

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    const request = latest.current.begin();
    try {
      const { overview } = await getResidentialOverview(organizationId, token);
      if (request.isCurrent()) setState({ organizationId, data: overview, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);
  const current = scopedTo(state, organizationId);
  const overview = current?.data ?? null;
  const error = current?.error === true;

  if (!residential) return <Navigate to="/agency" replace />;
  return (
    <div className="flex flex-col gap-6" data-testid="residential-panel">
      <PageHeader title={t("panel.title")} description={t("panel.description", { name: activeOrganization?.name ?? t("panel.nameFallback") })} />
      {error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : overview === null ? <Skeleton className="h-32" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{t("panel.activeResidents")}</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{overview.activeResidents}</p></Card>
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{t("panel.establishments")}</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{overview.establishments}</p></Card>
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{t("panel.planLimit")}</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{overview.planResidentLimit}</p></Card>
          </div>
          {overview.overPlanLimit && (
            <Card data-testid="residential-plan-alert" className="border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)]">
              <p className="text-[var(--text-small)] font-medium text-[var(--color-warning-700)]">
                {t("panel.overLimit", { limit: overview.planResidentLimit })}
              </p>
            </Card>
          )}
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("panel.modules")}</h2>
            <ul className="flex flex-col gap-1">
              {overview.features.filter((f) => f.code !== "DEMO_ENVIRONMENT").map((f) => (
                <li key={f.code} className="flex items-center justify-between text-[var(--text-small)]">
                  <span className="text-[var(--color-text-primary)]">{t(`panel.moduleLabels.${f.code}`)}</span>
                  <span className="text-[var(--color-text-secondary)]">{f.enabled ? t("panel.moduleOn") : t("panel.moduleOff")}</span>
                </li>
              ))}
            </ul>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("panel.modulesNote")}</p>
          </Card>
        </>
      )}
    </div>
  );
}
