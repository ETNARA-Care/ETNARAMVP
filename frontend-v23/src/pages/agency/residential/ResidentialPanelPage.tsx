import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Link } from "react-router-dom";
import { Badge, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { getResidentialOverview, type ResidentialOverview, type ResidentialPanel } from "@/api/residential";
import { isResidentialOrganization, RESIDENTIAL_ASSIGNMENTS_PATH, RESIDENTIAL_ATTENDANCE_PATH, RESIDENTIAL_REPORTS_PATH } from "@/features/residential/modality";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";

/**
 * 170 (hogares F0): panel base del hogar. Solo administrativo: recuentos y el estado de los módulos de hogar,
 * que nacen apagados y los enciende únicamente ETNARA central. Ninguna información de salud.
 * 177 (F5): panel completo (plan §4): presentes, residentes sin cobertura, ponches por revisar, alertas y ocupación.
 * Cada parte aparece solo si el backend la envía (su interruptor está encendido).
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
          {overview.panel && <PanelSections panel={overview.panel} />}
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

const fmtTime = (iso: string, lang: string | undefined) => new Date(iso).toLocaleTimeString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico", hour: "numeric", minute: "2-digit" });
function Metric({ label, value, to, tone }: { label: string; value: string | number; to?: string; tone?: "warning" }) {
  const body = (
    <Card className={`h-full ${tone === "warning" ? "border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)]" : ""}`}>
      <p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{label}</p>
      <p className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">{value}</p>
    </Card>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

/** 177 (F5): partes del panel completo. */
function PanelSections({ panel }: { panel: ResidentialPanel }) {
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const occ = panel.occupancy;
  return (
    <div className="flex flex-col gap-4" data-testid="residential-panel-full">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {panel.attendance && <Metric label={t("panel.full.present")} value={panel.attendance.present.length} to={RESIDENTIAL_ATTENDANCE_PATH} />}
        {panel.assignments && <Metric label={t("panel.full.uncovered")} value={panel.assignments.uncovered.length} to={RESIDENTIAL_ASSIGNMENTS_PATH} tone={panel.assignments.uncovered.length ? "warning" : undefined} />}
        {panel.attendance && <Metric label={t("panel.full.pendingReview")} value={panel.attendance.pendingReview} to={RESIDENTIAL_ATTENDANCE_PATH} tone={panel.attendance.pendingReview ? "warning" : undefined} />}
        {(panel.attendance || panel.assignments) && <Metric label={t("panel.full.alerts")} value={(panel.attendance?.openAlerts ?? 0) + (panel.assignments?.openCoverageAlerts ?? 0)} />}
      </div>
      {panel.attendance && panel.attendance.present.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("panel.full.presentTitle")}</h2>
          <ul className="flex flex-col gap-1 text-[var(--text-small)]">
            {panel.attendance.present.map((p, i) => <li key={i} className="text-[var(--color-text-primary)]">{t("panel.full.presentLine", { name: p.workerName ?? "—", establishment: p.establishment, time: fmtTime(p.since, lang) })}</li>)}
          </ul>
        </Card>
      )}
      {panel.assignments && panel.assignments.uncovered.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("panel.full.uncoveredTitle")}</h2>
          <ul className="flex flex-col gap-1 text-[var(--text-small)]">
            {panel.assignments.uncovered.map((u) => <li key={u.careRecipientId} className="text-[var(--color-text-primary)]">{`${u.name} · ${u.establishment}`}</li>)}
          </ul>
        </Card>
      )}
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{t("panel.full.occupancyTitle")}</h2>
          <Link to={RESIDENTIAL_REPORTS_PATH} className="text-[var(--text-small)] font-medium text-[var(--color-brand)]">{t("panel.full.reports")}</Link>
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">
          {occ.capacityConfigured
            ? t("panel.full.occupancyLine", { rooms: occ.rooms, occupied: occ.bedsOccupied, beds: occ.bedsRegistered, available: occ.bedsAvailable, percent: occ.occupancyPercent ?? 0 })
            : t("panel.full.occupancyNoCapacity", { rooms: occ.rooms, residents: occ.activeResidents })}
        </p>
        {occ.residentsWithoutRoom > 0 && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("panel.full.withoutRoom", { count: occ.residentsWithoutRoom })}</p>}
        {occ.overCapacity && <Badge tone="warning">{t("panel.full.overCapacity")}</Badge>}
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("panel.full.capacityNote")}</p>
      </Card>
    </div>
  );
}
