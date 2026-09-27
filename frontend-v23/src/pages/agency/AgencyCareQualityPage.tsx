import { useState } from "react";
import { Activity, Bot, ClipboardCheck, FileWarning, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  generateCareQualityAgentBriefing,
  type CareQualityAgentBriefing,
  type CareQualitySeverity,
} from "@/api/careQualityAgent";
import { Badge, Button, Card, PageHeader, StatCard, useToast } from "@/components/ui";

const tone: Record<CareQualitySeverity, "danger" | "warning" | "neutral"> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};

export function AgencyCareQualityPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [briefing, setBriefing] = useState<CareQualityAgentBriefing | null>(null);
  const [busy, setBusy] = useState(false);

  async function runAgent() {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId) return;
    setBusy(true);
    try {
      setBriefing(await generateCareQualityAgentBriefing(organizationId, token));
      show("El Agente de Calidad preparó el briefing.", "success");
    } catch {
      show("El agente no pudo analizar la documentación en este momento.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <PageHeader
        title="Calidad del cuidado"
        description="Revisión asistida de documentación y seguimiento"
      />

      <Card className="border border-[var(--color-border)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-700)] flex items-center justify-center shrink-0">
              <Bot size={21} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg">Agente de Calidad del Cuidado</h2>
                <Badge tone="neutral">Asesor · control humano</Badge>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Detecta faltantes verificables en turnos, observaciones e incidentes. No modifica expedientes ni emite conclusiones clínicas.
              </p>
            </div>
          </div>
          <Button icon={<Sparkles size={18} />} loading={busy} onClick={() => void runAgent()}>
            {briefing ? "Actualizar briefing" : "Generar briefing"}
          </Button>
        </div>

        {briefing && (
          <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
            <h3 className="font-medium text-base">{briefing.headline}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{briefing.narrative}</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <StatCard label="Turnos revisados" value={briefing.summary.reviewedShifts} icon={<ClipboardCheck size={18} />} />
              <StatCard label="Turnos con faltantes" value={briefing.summary.shiftsNeedingReview} tone={briefing.summary.shiftsNeedingReview ? "warning" : "neutral"} icon={<FileWarning size={18} />} />
              <StatCard label="Observaciones abiertas" value={briefing.summary.openObservations} tone={briefing.summary.openObservations ? "warning" : "neutral"} icon={<Activity size={18} />} />
              <StatCard label="Incidentes sin seguimiento" value={briefing.summary.incidentsWithoutFollowUp} tone={briefing.summary.incidentsWithoutFollowUp ? "warning" : "neutral"} icon={<FileWarning size={18} />} />
            </div>

            {briefing.priorities.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] mt-4">No hay faltantes prioritarios que recomendar.</p>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                {briefing.priorities.map((priority) => (
                  <div key={priority.key} className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[var(--color-text-muted)]">#{priority.rank}</span>
                          <Badge tone={tone[priority.severity]}>
                            {priority.severity === "critical" ? "Prioritaria" : priority.severity === "warning" ? "Atención" : "Revisión"}
                          </Badge>
                          <span className="font-medium text-sm">{priority.title}</span>
                        </div>
                        <p className="text-sm mt-2">{priority.detail}</p>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{priority.reason}</p>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Recomendación: {priority.recommendedAction}</p>
                      </div>
                      <Button variant="secondary" onClick={() => navigate(priority.actionPath)}>Revisar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)] mt-4">{briefing.guardrails.join(" · ")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
