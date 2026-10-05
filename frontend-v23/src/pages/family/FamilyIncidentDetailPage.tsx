import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listMyCareRecipients, type FamilyRecipient } from "@/api/familyTimeline";
import { listFamilyIncidents, type FamilyIncident } from "@/api/incidents";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";

const statusLabels: Record<string, string> = {
  open: "Reportado",
  in_progress: "En seguimiento",
  resolved: "Atendido",
};

export function FamilyIncidentDetailPage() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const [incident, setIncident] = useState<FamilyIncident | null | undefined>(undefined);
  const [recipient, setRecipient] = useState<FamilyRecipient | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !incidentId) return;
    setError(false);
    try {
      const recipients = (await listMyCareRecipients(token)).filter(
        (item) => !activeOrganization || item.organizationId === activeOrganization.id,
      );
      const results = await Promise.all(recipients.map(async (item) => ({
        recipient: item,
        incidents: await listFamilyIncidents(item.organizationId, item.recipientId, token),
      })));
      const match = results.find((result) => result.incidents.some((item) => item.id === incidentId));
      setRecipient(match?.recipient ?? null);
      setIncident(match?.incidents.find((item) => item.id === incidentId) ?? null);
    } catch {
      setIncident(null);
      setError(true);
    }
  }, [activeOrganization, incidentId]);

  useEffect(() => { void load(); }, [load]);

  if (incident === undefined) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!incident || !recipient) return <ErrorState kind="not_found" />;

  const recipientName = recipient.preferredName || `${recipient.firstName} ${recipient.lastName}`.trim();
  return (
    <div className="space-y-5">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate(-1)} className="self-start">
        Volver
      </Button>
      <section><p className="text-sm font-medium text-[#66845f]">Incidentes</p><h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">Detalle del incidente</h1><p className="mt-1 text-sm text-[#667085]">Información autorizada sobre {recipientName}.</p></section>
      <Card className="rounded-[22px] border-[#102b57]/10 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="shrink-0 text-[#b86f52]" />
            <p className="font-medium text-[var(--color-text-primary)]">Incidente reportado</p>
          </div>
          <Badge tone={incident.status === "resolved" ? "success" : "warning"}>{statusLabels[incident.status] ?? incident.status}</Badge>
        </div>
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Qué ocurrió</dt>
            <dd className="text-[var(--text-body)] text-[var(--color-text-primary)] mt-1">{incident.description}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Fecha y hora</dt>
            <dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">
              {new Date(incident.createdAt).toLocaleString("es-PR", { dateStyle: "long", timeStyle: "short" })}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Estado</dt>
            <dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{statusLabels[incident.status] ?? incident.status}</dd>
          </div>
        </dl>
      </Card>
      <Card className="flex items-start gap-3 rounded-[22px] border-[#66845f]/20 bg-[#f8f5ee]">
        <ShieldCheck size={22} className="text-[var(--color-success-700)] shrink-0" />
        <div>
          <p className="font-medium text-[#173154]">El equipo de cuidado fue notificado</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">
            El reporte fue recibido y se dará seguimiento conforme al protocolo de cuidado.
          </p>
        </div>
      </Card>
      <div className="flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-[#667085] shadow-sm"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#66845f]" /><p>No necesitas realizar ninguna acción en este momento.</p></div>
      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">
        Por privacidad, esta vista no muestra notas internas, documentos ni datos del proceso administrativo.
      </p>
    </div>
  );
}
