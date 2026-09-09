import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listIncidents, type Incident } from "@/api/incidents";
import { listCareRecipients, recipientName, type CareRecipient } from "@/api/shifts";

export function AgencyIncidentsPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const [incidentRows, recipientRows] = await Promise.all([
        listIncidents(organizationId, token),
        listCareRecipients(organizationId, token),
      ]);
      setIncidents(incidentRows);
      setRecipients(recipientRows);
    } catch {
      setIncidents([]);
      setRecipients([]);
      setError(true);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const recipientById = useMemo(
    () => Object.fromEntries(recipients.map((recipient) => [recipient.id, recipient])),
    [recipients],
  );

  if (incidents === null) {
    return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  }
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  return (
    <div>
      <PageHeader
        title="Incidentes"
        description="Reportes reales pendientes de revisión administrativa."
      />
      {openIncidents.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={28} />} title="No hay incidentes abiertos." />
      ) : (
        <div className="flex flex-col gap-2">
          {openIncidents.map((incident) => (
            <Card key={incident.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text-primary)]">Incidente reportado</p>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                  {recipientName(recipientById[incident.care_recipient_id])}
                </p>
                <p className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{incident.description}</p>
                <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">
                  {new Date(incident.created_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <Badge tone="danger">Severidad {incident.severity}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
