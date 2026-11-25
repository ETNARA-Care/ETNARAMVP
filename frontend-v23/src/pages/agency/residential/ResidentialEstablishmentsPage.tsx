import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { residentialApi, type ResidentialEstablishmentSummary } from "@/api/residential";
import { isResidentialOrganization, RESIDENTIAL_ESTABLISHMENTS_PATH } from "@/features/residential/modality";
import { OccupancySummary } from "./OccupancySummary";

/**
 * 171 (hogares F1): establecimientos del hogar con su ocupación. Crear o renombrar un establecimiento se hace en
 * Configuración → Establecimientos (pantalla de siempre); aquí se administran unidades, habitaciones, camas,
 * ubicación de residentes, geocerca y cierre.
 */
export function ResidentialEstablishmentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const [items, setItems] = useState<ResidentialEstablishmentSummary[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    setError(false);
    try { setItems((await residentialApi.listEstablishments(organizationId, token)).establishments); }
    catch { setError(true); }
  }, [organizationId, residential]);
  useEffect(() => { void load(); }, [load]);

  if (!residential) return <Navigate to="/agency" replace />;
  return (
    <div className="flex flex-col gap-6" data-testid="residential-establishments">
      <PageHeader title="Establecimientos y habitaciones" description="Unidades, habitaciones, camas y ubicación de residentes de cada establecimiento." />
      {error ? <ErrorState kind="server" onRetry={() => void load()} /> : items === null ? <Skeleton className="h-32" /> : items.length === 0 ? (
        <EmptyState title="Todavía no hay establecimientos" description="Créalos en Configuración → Establecimientos. La unidad «General» se crea sola." />
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
                  {e.status === "closed" ? <Badge tone="neutral">Cerrado</Badge> : e.occupancy.overCapacity ? <Badge tone="warning">Supera las camas</Badge> : null}
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
