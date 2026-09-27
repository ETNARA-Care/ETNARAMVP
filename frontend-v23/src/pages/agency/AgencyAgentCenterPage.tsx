import { useState } from "react";
import {
  Bot,
  CalendarSearch,
  HeartHandshake,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { generateOperationsAgentBriefing } from "@/api/operations";
import { generateComplianceAgentBriefing } from "@/api/compliance";
import { generateCoverageAgentBriefing } from "@/api/coverageAgent";
import { generateCareQualityAgentBriefing } from "@/api/careQualityAgent";
import { Badge, Button, Card, PageHeader, useToast } from "@/components/ui";

type AgentKey = "operations" | "compliance" | "coverage" | "quality";

interface AgentSnapshot {
  headline: string;
  narrative: string;
  priorityCount: number;
  generatedAt: string;
}

const AGENTS: Array<{
  key: AgentKey;
  name: string;
  pillar: string;
  description: string;
  destination: string;
}> = [
  {
    key: "operations",
    name: "Agente de Operaciones",
    pillar: "Operación B2B",
    description: "Prioriza alertas reales de turnos, entradas, credenciales, incidentes y horas.",
    destination: "/agency/operations",
  },
  {
    key: "compliance",
    name: "Agente de Cumplimiento",
    pillar: "ETNARA Compliance",
    description: "Explica bloqueos de elegibilidad y vencimientos del personal sin aprobar documentos.",
    destination: "/agency/compliance",
  },
  {
    key: "coverage",
    name: "Agente de Cobertura",
    pillar: "ETNARA Workforce",
    description: "Prioriza turnos descubiertos y dirige al flujo existente de oferta o asignación.",
    destination: "/agency/shifts",
  },
  {
    key: "quality",
    name: "Agente de Calidad",
    pillar: "ETNARA Care",
    description: "Detecta faltantes documentales y seguimiento pendiente sin emitir conclusiones clínicas.",
    destination: "/agency/quality",
  },
];

const PILLARS = [
  { name: "Compliance", detail: "Credenciales, requisitos y expedientes", destination: "/agency/compliance", icon: ShieldCheck },
  { name: "Workforce", detail: "Personal, disponibilidad y cobertura", destination: "/agency/shifts", icon: CalendarSearch },
  { name: "Care", detail: "Residentes, cuidado e incidentes", destination: "/agency/residents", icon: Stethoscope },
  { name: "Family", detail: "Acceso y comunicación controlados", destination: "/agency/messages", icon: HeartHandshake },
];

export function AgencyAgentCenterPage() {
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [snapshots, setSnapshots] = useState<Partial<Record<AgentKey, AgentSnapshot>>>({});
  const [errors, setErrors] = useState<Partial<Record<AgentKey, true>>>({});
  const [busy, setBusy] = useState(false);

  async function runAllAgents() {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId) return;

    setBusy(true);
    setErrors({});
    const requests = [
      generateOperationsAgentBriefing(organizationId, token),
      generateComplianceAgentBriefing(organizationId, token),
      generateCoverageAgentBriefing(organizationId, token),
      generateCareQualityAgentBriefing(organizationId, token),
    ];
    const settled = await Promise.allSettled(requests);
    const nextSnapshots: Partial<Record<AgentKey, AgentSnapshot>> = {};
    const nextErrors: Partial<Record<AgentKey, true>> = {};

    settled.forEach((result, index) => {
      const key = AGENTS[index].key;
      if (result.status === "fulfilled") {
        nextSnapshots[key] = {
          headline: result.value.headline,
          narrative: result.value.narrative,
          priorityCount: result.value.priorities.length,
          generatedAt: result.value.generatedAt,
        };
      } else {
        nextErrors[key] = true;
      }
    });

    setSnapshots(nextSnapshots);
    setErrors(nextErrors);
    setBusy(false);
    const succeeded = settled.filter((result) => result.status === "fulfilled").length;
    if (succeeded === AGENTS.length) show("Los cuatro agentes completaron el análisis.", "success");
    else if (succeeded > 0) show("El análisis terminó con resultados parciales.", "warning");
    else show("Los agentes no pudieron analizar la organización en este momento.", "danger");
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]">
      <PageHeader
        title="Centro de agentes"
        description="Briefings administrativos de Compliance, Workforce, Care y operaciones"
        actions={(
          <Button icon={<Sparkles size={18} />} loading={busy} onClick={() => void runAllAgents()}>
            Analizar organización
          </Button>
        )}
      />

      <Card className="border border-[var(--color-border)]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent-100)] text-[var(--color-accent-700)] flex items-center justify-center shrink-0">
            <Bot size={21} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg">Asistencia coordinada</h2>
              <Badge tone="neutral">Asesor · control humano</Badge>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Cada agente analiza su fuente autorizada y conserva su propia auditoría. Este centro no asigna personal, aprueba documentos, modifica expedientes ni comparte información con Family.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {AGENTS.map((agent) => {
          const snapshot = snapshots[agent.key];
          const failed = errors[agent.key];
          return (
            <Card key={agent.key}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="neutral">{agent.pillar}</Badge>
                  <h2 className="font-display text-lg mt-2">{agent.name}</h2>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{agent.description}</p>
                </div>
                <Bot size={20} className="text-[var(--color-accent-700)] shrink-0" />
              </div>

              {failed && (
                <p className="text-sm text-[var(--color-danger-700)] mt-4">
                  Este agente no respondió. Los demás resultados permanecen disponibles.
                </p>
              )}
              {snapshot && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={snapshot.priorityCount > 0 ? "warning" : "success"}>
                      {snapshot.priorityCount} prioridad{snapshot.priorityCount === 1 ? "" : "es"}
                    </Badge>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {new Date(snapshot.generatedAt).toLocaleString("es-PR")}
                    </span>
                  </div>
                  <p className="font-medium text-sm mt-2">{snapshot.headline}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{snapshot.narrative}</p>
                </div>
              )}

              <div className="mt-4">
                <Button variant="secondary" onClick={() => navigate(agent.destination)}>
                  Abrir espacio del agente
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessagesSquare size={19} className="text-[var(--color-accent-700)]" />
          <h2 className="font-display text-lg">Organización del producto B2B</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <button
                key={pillar.name}
                type="button"
                className="text-left rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent-500)] transition-colors"
                onClick={() => navigate(pillar.destination)}
              >
                <Icon size={20} className="text-[var(--color-accent-700)]" />
                <p className="font-medium mt-2">ETNARA {pillar.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{pillar.detail}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Family conserva endpoints y permisos propios; no participa en los análisis organizacionales de los agentes.
        </p>
      </div>
    </div>
  );
}
