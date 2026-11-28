import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { assignmentsApi, type MyResident } from "@/api/residentialAssignments";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization } from "@/features/residential/modality";

/**
 * 176 (hogares F3): «Mis residentes». Solo hogares y solo con HOGAR_ASIGNACIONES. Lista lo que el backend devuelve:
 * los residentes asignados AHORA (por la RLS y la asignación activa), y hasta cuándo. Sin asignación, ninguno.
 */
const fmt = (iso: string, lang: string | undefined) => new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico", hour: "numeric", minute: "2-digit" });

export function CaregiverResidentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_ASIGNACIONES");
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.resolvedLanguage;
  const [state, setState] = useState<OrganizationScoped<MyResident[]> | null>(null);
  const latest = useRef(createLatestRequest());
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential || !enabled) return;
    const request = latest.current.begin();
    try {
      const { residents } = await assignmentsApi.me(organizationId, token);
      if (request.isCurrent()) setState({ organizationId, data: residents, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential, enabled]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);

  if (!residential || !enabled) return <Navigate to="/caregiver/today" replace />;
  const current = scopedTo(state, organizationId);
  const residents = current?.data ?? null;
  return (
    <div className="flex flex-col gap-5" data-testid="caregiver-residents">
      <PageHeader title={t("assignments.mine.title")} description={t("assignments.mine.description")} />
      {current?.error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : residents === null ? <Skeleton className="h-32" /> : residents.length === 0 ? (
        <EmptyState title={t("assignments.mine.emptyTitle")} description={t("assignments.mine.emptyDetail")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {residents.map((r) => (
            <li key={`${r.shiftId}|${r.careRecipientId}`}><Card className="p-[var(--spacing-md)]">
              <p className="font-medium text-[var(--color-text-primary)]">{r.name}</p>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("assignments.mine.until", { establishment: r.establishment, time: fmt(r.until, lang) })}</p>
            </Card></li>
          ))}
        </ul>
      )}
    </div>
  );
}
