import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw, ShieldAlert, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import {
  getWorkforceForecast,
  type DailyWorkforceForecast,
  type WorkforceForecast,
  type WorkforceRisk,
} from "@/api/workforcePlanning";
import { Badge, Button, Card, ErrorState, PageHeader, Select, Skeleton, StatCard } from "@/components/ui";

const riskPresentation: Record<WorkforceRisk, { label: string; tone: "success" | "warning" | "danger" }> = {
  stable: { label: "Estable", tone: "success" },
  watch: { label: "Vigilar", tone: "warning" },
  high: { label: "Riesgo alto", tone: "danger" },
  critical: { label: "Crítico", tone: "danger" },
};

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function hours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-PR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function AgencyWorkforcePlanningPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const [horizon, setHorizon] = useState<7 | 14 | 30>(14);
  const [forecast, setForecast] = useState<WorkforceForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<"network" | "server" | "permission" | null>(null);
  const organizationId = activeOrganization?.id;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setLoading(true);
    setErrorKind(null);
    try {
      const result = await getWorkforceForecast(organizationId, {
        startDate: today(),
        days: horizon,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Puerto_Rico",
      }, token);
      setForecast(result);
    } catch (requestError) {
      const apiError = requestError as ApiError;
      setErrorKind(apiError.status === 403 ? "permission" : apiError.status === 0 ? "network" : "server");
    } finally {
      setLoading(false);
    }
  }, [horizon, organizationId]);

  // Loading from the authoritative API is the intended effect synchronization.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const visibleDays = forecast?.days.filter((day) => day.totalShifts > 0) ?? [];

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <PageHeader
        title="Planificación de personal"
        description="Anticipa déficits de cobertura con datos reales antes de que afecten la operación."
        actions={<Button variant="secondary" icon={<RefreshCw size={18} />} onClick={() => void load()} loading={loading}>Actualizar</Button>}
      />

      <Card className="flex flex-col gap-3 border-[var(--color-accent-100)] bg-[var(--color-accent-100)]">
        <div className="flex items-center gap-2 text-[var(--color-navy-800)]">
          <Sparkles size={20} aria-hidden />
          <h2 className="font-display text-[var(--text-h3)]">Análisis de ETNARA</h2>
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          ETNARA combina turnos, roles, elegibilidad, disponibilidad y vencimientos. Recomienda; Administración decide y confirma cualquier acción.
        </p>
        {forecast?.assistantSummary.map((item) => <p key={item} className="text-[var(--text-body)] text-[var(--color-text-primary)]">• {item}</p>)}
      </Card>

      <div className="w-full sm:max-w-[320px]">
        <Select label="Periodo de análisis" value={horizon} onChange={(event) => setHorizon(Number(event.target.value) as 7 | 14 | 30)}>
          <option value={7}>Próximos 7 días</option>
          <option value={14}>Próximos 14 días</option>
          <option value={30}>Próximos 30 días</option>
        </Select>
      </div>

      {loading && !forecast ? <PlanningSkeleton /> : errorKind ? <ErrorState kind={errorKind} onRetry={() => void load()} /> : forecast && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--spacing-sm)]" aria-label="Resumen predictivo">
            <StatCard label="Días en riesgo" value={forecast.summary.highRiskDays} tone={forecast.summary.highRiskDays > 0 ? "danger" : "success"} icon={<AlertTriangle size={18} />} />
            <StatCard label="Turnos sin cubrir" value={forecast.summary.uncoveredShifts} tone={forecast.summary.uncoveredShifts > 0 ? "warning" : "success"} icon={<CalendarClock size={18} />} />
            <StatCard label="Personal apto" value={forecast.summary.eligibleWorkers} tone="success" icon={<Users size={18} />} />
            <StatCard label="Vencimientos" value={forecast.summary.credentialRisks} tone={forecast.summary.credentialRisks > 0 ? "warning" : "neutral"} icon={<ShieldAlert size={18} />} />
          </section>

          {forecast.summary.workersWithoutAvailability > 0 && (
            <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[var(--text-body)] text-[var(--color-text-primary)]">
                {forecast.summary.workersWithoutAvailability} cuidador(es) aptos aún no tienen disponibilidad configurada; la capacidad conocida puede ser menor que la real.
              </p>
              <Button variant="secondary" onClick={() => navigate("/agency/workers")}>Ver cuidadores</Button>
            </Card>
          )}

          <section className="flex flex-col gap-[var(--spacing-sm)]">
            <h2 className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">Riesgo por día</h2>
            {visibleDays.length > 0
              ? visibleDays.map((day) => <ForecastDay key={day.date} day={day} onOpenShifts={() => navigate("/agency/shifts")} />)
              : <Card><p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">No hay turnos programados dentro de este periodo. ETNARA actualizará el análisis cuando se creen turnos futuros.</p></Card>}
          </section>

          {forecast.credentialRisks.length > 0 && (
            <section className="flex flex-col gap-[var(--spacing-sm)]">
              <h2 className="font-display text-[var(--text-h2)] text-[var(--color-text-primary)]">Credenciales que vencerán</h2>
              {forecast.credentialRisks.map((risk) => (
                <Card key={`${risk.membershipId}:${risk.credentialTypeCode}:${risk.expiresAt}`} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{risk.displayName || risk.internalRole}</p>
                    <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{risk.credentialTypeCode} · vence {new Date(`${risk.expiresAt}T12:00:00`).toLocaleDateString("es-PR")}</p>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(`/agency/workers/${risk.membershipId}`)}>Revisar</Button>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ForecastDay({ day, onOpenShifts }: { day: DailyWorkforceForecast; onOpenShifts: () => void }) {
  const presentation = riskPresentation[day.risk];
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[var(--text-h3)] capitalize text-[var(--color-text-primary)]">{dayLabel(day.date)}</h3>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {day.totalShifts} turno(s) · {hours(day.requiredMinutes)} requeridas · {hours(day.knownAvailableMinutes)} disponibles conocidas
          </p>
        </div>
        <Badge tone={presentation.tone}>{presentation.label}</Badge>
      </div>

      {day.roles.map((role) => (
        <div key={role.role} className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3">
          <div className="flex justify-between gap-3">
            <span className="font-medium text-[var(--color-text-primary)]">{role.role}</span>
            <span className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Brecha: {hours(role.coverageGapMinutes)}</span>
          </div>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">
            {role.eligibleWorkers} apto(s) · {role.uncoveredShifts} turno(s) sin cubrir · {role.unknownAvailabilityWorkers} disponibilidad(es) desconocida(s)
          </p>
        </div>
      ))}

      <div className="flex flex-col gap-1">
        {day.explanations.map((explanation) => <p key={explanation} className="text-[var(--text-small)] text-[var(--color-text-secondary)]">• {explanation}</p>)}
      </div>
      {day.recommendedActions.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
          <p className="text-[var(--text-small)] font-medium text-[var(--color-text-primary)]">Acciones sugeridas</p>
          {day.recommendedActions.map((action) => <p key={action} className="text-[var(--text-caption)] text-[var(--color-text-secondary)] mt-1">• {action}</p>)}
        </div>
      )}
      {day.uncoveredShifts > 0 && <Button variant="secondary" onClick={onOpenShifts}>Abrir turnos sin cubrir</Button>}
    </Card>
  );
}

function PlanningSkeleton() {
  return <div className="flex flex-col gap-3"><Skeleton className="h-28" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
}
