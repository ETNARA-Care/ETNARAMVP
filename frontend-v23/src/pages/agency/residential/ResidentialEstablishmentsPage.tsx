import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { residentialApi, type ResidentialEstablishmentSummary } from "@/api/residential";
import { isResidentialOrganization, RESIDENTIAL_ESTABLISHMENTS_PATH } from "@/features/residential/modality";
import { OccupancySummary } from "./OccupancySummary";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";

/**
 * 171 (hogares F1): establecimientos del hogar con su ocupación. Crear o renombrar un establecimiento se hace en
 * Configuración → Establecimientos (pantalla de siempre); aquí se administran unidades, habitaciones, camas,
 * ubicación de residentes, geocerca y cierre.
 */
export function ResidentialEstablishmentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const { t } = useTranslation("residential");
  // Protección de cambio de organización (como el panel, A4): la lista va ligada a la organización que la pidió.
  const [state, setState] = useState<OrganizationScoped<ResidentialEstablishmentSummary[]> | null>(null);
  const latest = useRef(createLatestRequest());

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    const request = latest.current.begin();
    try {
      const { establishments } = await residentialApi.listEstablishments(organizationId, token);
      if (request.isCurrent()) setState({ organizationId, data: establishments, error: false });
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
  const items = current?.data ?? null;
  const error = current?.error === true;

  if (!residential) return <Navigate to="/agency" replace />;
  return (
    <div className="flex flex-col gap-6" data-testid="residential-establishments">
      <PageHeader title={t("establishments.title")} description={t("establishments.description")} />
      {error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : items === null ? <Skeleton className="h-32" /> : items.length === 0 ? (
        <EmptyState title={t("establishments.emptyTitle")} description={t("establishments.emptyDetail")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((e) => (
            <Link key={e.id} to={`${RESIDENTIAL_ESTABLISHMENTS_PATH}/${e.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-700)] rounded-[var(--radius-lg)]">
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{e.name}</h2>
                    {e.address && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{e.address}</p>}
                  </div>
                  {e.status === "closed" ? <Badge tone="neutral">{t("establishments.closed")}</Badge> : e.occupancy.overCapacity ? <Badge tone="warning">{t("establishments.overCapacityBadge")}</Badge> : null}
                </div>
                <OccupancySummary occupancy={e.occupancy} compact />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
