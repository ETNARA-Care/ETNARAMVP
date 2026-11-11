import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listIncidents, type Incident } from "@/api/incidents";
import { listCareRecipients, recipientName, type CareRecipient } from "@/api/shifts";

export function AgencyIncidentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // 154: resolved incidents stay consultable (history), apart from the open ones.
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const resolvedIncidents = incidents.filter((incident) => incident.status === "resolved")
    .sort((a, b) => new Date(b.resolved_at ?? b.created_at).getTime() - new Date(a.resolved_at ?? a.created_at).getTime());
  const list = (rows: Incident[], resolved: boolean) => rows.length === 0 ? (
    <EmptyState icon={<ShieldCheck size={28} />} title={resolved ? "Aún no hay incidentes resueltos." : "No hay incidentes abiertos."} />
  ) : (
    <div className="flex flex-col gap-2">
      {rows.map((incident) => (
        <button key={incident.id} type="button" className="text-left" onClick={() => navigate(`/agency/incidents/${incident.id}`)}>
          <Card className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3 hover:bg-[var(--color-ivory-100)] transition-colors">
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-text-primary)]">{resolved ? "Incidente resuelto" : incident.status === "in_progress" ? "Incidente en seguimiento" : "Incidente reportado"}</p>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                {recipientName(recipientById[incident.care_recipient_id])}
              </p>
              <p className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1 break-words">{incident.description}</p>
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">
                {resolved && incident.resolved_at
                  ? `Resuelto ${new Date(incident.resolved_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}`
                  : new Date(incident.created_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <Badge tone={resolved ? "neutral" : "danger"}>Severidad {incident.severity}</Badge>
          </Card>
        </button>
      ))}
    </div>
  );
  return (
    <div>
      <PageHeader
        title="Incidentes"
        description="Reportes reales: los abiertos requieren atención; los resueltos quedan en el historial."
      />
      <Tabs
        items={[{ id: "open", label: `Abiertos (${openIncidents.length})` }, { id: "resolved", label: `Resueltos (${resolvedIncidents.length})` }]}
        defaultValue={searchParams.get("tab") === "resolved" ? "resolved" : "open"}
      >
        {(active) => <div className="mt-4">{active === "resolved" ? list(resolvedIncidents, true) : list(openIncidents, false)}</div>}
      </Tabs>
    </div>
  );
}
