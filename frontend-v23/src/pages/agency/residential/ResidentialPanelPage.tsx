import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { getResidentialOverview, type ResidentialOverview } from "@/api/residential";
import { isResidentialOrganization } from "@/features/residential/modality";

const MODULE_LABELS: Record<ResidentialOverview["features"][number]["code"], string> = {
  HOGAR_CALENDARIO: "Calendario del hogar",
  HOGAR_ASIGNACIONES: "Asignación de residentes",
  HOGAR_PONCHES: "Ponches de entrada y salida",
  DEMO_ENVIRONMENT: "Entorno de demostración",
};

/**
 * 170 (hogares F0): panel base del hogar. Solo administrativo: recuentos y el estado de los módulos de hogar,
 * que nacen apagados y los enciende únicamente ETNARA central. Ningún nombre ni información de salud.
 */
export function ResidentialPanelPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const [overview, setOverview] = useState<ResidentialOverview | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential) return;
    setError(false);
    try { setOverview((await getResidentialOverview(organizationId, token)).overview); }
    catch { setError(true); }
  }, [organizationId, residential]);
  useEffect(() => { void load(); }, [load]);

  if (!residential) return <Navigate to="/agency" replace />;
  return (
    <div className="flex flex-col gap-6" data-testid="residential-panel">
      <PageHeader title="Panel del hogar" description={`Administración de ${activeOrganization?.name ?? "tu hogar"}.`} />
      {error ? <ErrorState kind="server" onRetry={() => void load()} /> : overview === null ? <Skeleton className="h-32" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Residentes activos</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{overview.activeResidents}</p></Card>
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Establecimientos</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{overview.establishments}</p></Card>
            <Card><p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Residentes incluidos en el plan</p><p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{overview.planResidentLimit}</p></Card>
          </div>
          {overview.overPlanLimit && (
            <Card data-testid="residential-plan-alert" className="border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)]">
              <p className="text-[var(--text-small)] font-medium text-[var(--color-warning-700)]">
                El hogar tiene más de {overview.planResidentLimit} residentes activos. Comunícate con ETNARA para revisar tu plan. Nada se bloquea.
              </p>
            </Card>
          )}
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Módulos del hogar</h2>
            <ul className="flex flex-col gap-1">
              {overview.features.filter((f) => f.code !== "DEMO_ENVIRONMENT").map((f) => (
                <li key={f.code} className="flex items-center justify-between text-[var(--text-small)]">
                  <span className="text-[var(--color-text-primary)]">{MODULE_LABELS[f.code]}</span>
                  <span className="text-[var(--color-text-secondary)]">{f.enabled ? "Activo" : "No disponible todavía"}</span>
                </li>
              ))}
            </ul>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Los módulos los activa ETNARA cuando estén listos para tu hogar.</p>
          </Card>
        </>
      )}
    </div>
  );
}
