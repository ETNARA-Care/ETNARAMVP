import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Bot,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  escalateOperationalAlert,
  generateOperationsAgentBriefing,
  getOperationsCenter,
  type OperationalAlert,
  type OperationsAgentBriefing,
  type OperationsCenter,
} from "@/api/operations";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  useToast,
} from "@/components/ui";

const tone = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
} as const;

export function AgencyOperationsPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [data, setData] = useState<OperationsCenter | null>(null);
  const [briefing, setBriefing] = useState<OperationsAgentBriefing | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId) return;
    setError(false);
    try {
      setData(await getOperationsCenter(organizationId, token));
    } catch {
      setError(true);
    }
  }, [activeOrganization?.id]);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function runAgent() {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId) return;
    setAgentBusy(true);
    try {
      setBriefing(await generateOperationsAgentBriefing(organizationId, token));
      show("El Agente de Operaciones preparó el briefing.", "success");
    } catch {
      show("El agente no pudo analizar la operación en este momento.", "danger");
    } finally {
      setAgentBusy(false);
    }
  }

  async function escalate(alert: OperationalAlert) {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId) return;
    setBusy(alert.key);
    try {
      await escalateOperationalAlert(organizationId, alert, token);
      show("Alerta escalada al Supervisor.", "success");
      await load();
    } catch {
      show("La alerta ya no está activa o no pudo escalarse.", "danger");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <PageHeader
        title="Centro operacional"
        description="Alertas reales, prioridades asistidas y acciones de la agencia"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw size={18} />}
            onClick={() => void load()}
          >
            Actualizar
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Alertas activas"
          value={data.summary.total}
          icon={<BellRing size={18} />}
        />
        <StatCard
          label="Críticas"
          value={data.summary.critical}
          tone={data.summary.critical ? "danger" : "neutral"}
          icon={<ShieldAlert size={18} />}
        />
        <StatCard
          label="Requieren atención"
          value={data.summary.warning}
          tone={data.summary.warning ? "warning" : "neutral"}
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label="Informativas"
          value={data.summary.info}
          icon={<CheckCircle2 size={18} />}
        />
      </section>

      <Card className="border border-[var(--color-border)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-700)] flex items-center justify-center shrink-0">
              <Bot size={21} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg">Agente de Operaciones</h2>
                <Badge tone="neutral">Asesor · control humano</Badge>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Analiza los registros actuales, explica riesgos y propone qué atender primero.
                No ejecuta decisiones.
              </p>
            </div>
          </div>
          <Button
            icon={<Sparkles size={18} />}
            loading={agentBusy}
            onClick={() => void runAgent()}
          >
            {briefing ? "Actualizar briefing" : "Generar briefing"}
          </Button>
        </div>

        {briefing && (
          <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
            <h3 className="font-medium text-base">{briefing.headline}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {briefing.narrative}
            </p>

            {briefing.priorities.length === 0 ? (
              <div className="mt-4 text-sm text-[var(--color-text-secondary)]">
                No hay tareas prioritarias que recomendar.
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                {briefing.priorities.map((priority) => (
                  <div
                    key={priority.alertKey}
                    className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                            #{priority.rank}
                          </span>
                          <Badge tone={tone[priority.severity]}>
                            {priority.severity === "critical"
                              ? "Crítica"
                              : priority.severity === "warning"
                                ? "Atención"
                                : "Información"}
                          </Badge>
                          <span className="font-medium text-sm">{priority.title}</span>
                        </div>
                        <p className="text-sm mt-2">{priority.reason}</p>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          Recomendación: {priority.recommendedAction}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => navigate(priority.actionPath)}
                      >
                        Revisar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              {briefing.guardrails.join(" · ")}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg">Resumen de hoy</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Prioriza faltas de entrada y turnos próximos sin cubrir; luego atiende
          incidentes, credenciales y horas. ETNARA recomienda y alerta, pero las
          decisiones permanecen en Administración.
        </p>
      </Card>

      {data.alerts.length === 0 ? (
        <EmptyState
          title="La operación está al día"
          description="No hay alertas activas que requieran atención."
        />
      ) : (
        <section className="flex flex-col gap-3">
          {data.alerts.map((alert) => (
            <Card
              key={alert.key}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex gap-2 items-center">
                  <Badge tone={tone[alert.severity]}>
                    {alert.severity === "critical"
                      ? "Crítica"
                      : alert.severity === "warning"
                        ? "Atención"
                        : "Información"}
                  </Badge>
                  <h3 className="font-medium">{alert.title}</h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {alert.detail}
                </p>
                {alert.escalatedAt && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Escalada al Supervisor
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => navigate(alert.actionPath)}
                >
                  Atender
                </Button>
                <Button
                  onClick={() => void escalate(alert)}
                  disabled={!!alert.escalatedAt || busy === alert.key}
                  loading={busy === alert.key}
                >
                  {alert.escalatedAt ? "Escalada" : "Escalar"}
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
