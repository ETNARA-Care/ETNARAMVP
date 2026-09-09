import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock3, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getIncident, listIncidentTimeline, type Incident, type IncidentTimelineEntry } from "@/api/incidents";
import { getCareRecipient, listWorkers, recipientName, type CareRecipient, type WorkerMembership } from "@/api/shifts";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Timeline } from "@/components/ui";

const statusLabels: Record<string, string> = { open: "Abierto", in_progress: "En seguimiento", resolved: "Resuelto" };

export function AgencyIncidentDetailPage() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [incident, setIncident] = useState<Incident | null | undefined>(undefined);
  const [recipient, setRecipient] = useState<CareRecipient | null>(null);
  const [reporter, setReporter] = useState<WorkerMembership | null>(null);
  const [timeline, setTimeline] = useState<IncidentTimelineEntry[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !incidentId || !token) return;
    setError(false);
    try {
      const row = await getIncident(organizationId, incidentId, token);
      const [recipientRow, workers, timelineRows] = await Promise.all([
        getCareRecipient(organizationId, row.care_recipient_id, token),
        listWorkers(organizationId, token),
        listIncidentTimeline(organizationId, incidentId, token),
      ]);
      setIncident(row);
      setRecipient(recipientRow);
      setReporter(workers.find((worker) => worker.id === row.organization_worker_membership_id) ?? null);
      setTimeline(timelineRows);
    } catch {
      setIncident(null);
      setError(true);
    }
  }, [incidentId, organizationId]);

  useEffect(() => { void load(); }, [load]);

  if (incident === undefined) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-56" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!incident || !recipient) return <ErrorState kind="not_found" />;

  const reporterName = reporter?.display_name || reporter?.internal_role || "Personal de cuidado";
  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate(-1)} className="self-start">Volver</Button>
      <PageHeader
        title="Detalle del incidente"
        description={`Reporte operacional de ${recipientName(recipient)}.`}
        actions={<Button variant="secondary" icon={<UserRound size={18} />} onClick={() => navigate(`/agency/residents/${recipient.id}`)}>Ver residente</Button>}
      />
      <Card>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={22} className="text-[var(--color-danger-700)]" />
            <p className="font-medium text-[var(--color-text-primary)]">{incident.description}</p>
          </div>
          <Badge tone="danger">Severidad {incident.severity}</Badge>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Estado" value={statusLabels[incident.status] ?? incident.status} />
          <Detail label="Reportado por" value={reporterName} />
          <Detail label="Fecha y hora" value={new Date(incident.created_at).toLocaleString("es-PR", { dateStyle: "long", timeStyle: "short" })} />
          <Detail label="Acciones inmediatas" value={incident.actions_taken || "No se documentaron acciones inmediatas."} />
          {incident.resolution && <Detail label="Resolución" value={incident.resolution} />}
        </dl>
      </Card>
      <div>
        <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)] mb-3">Seguimiento</h2>
        {timeline.length === 0 ? (
          <EmptyState icon={<Clock3 size={28} />} title="Aún no hay entradas de seguimiento." />
        ) : (
          <Timeline entries={timeline.map((entry) => ({
            id: entry.id,
            time: new Date(entry.occurred_at).toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" }),
            title: entry.entry_text,
          }))} />
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</dt><dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{value}</dd></div>;
}
