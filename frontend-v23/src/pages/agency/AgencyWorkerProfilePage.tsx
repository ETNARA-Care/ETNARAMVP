import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getWorkerProfile, listWorkers, type WorkerCredentialSummary, type WorkerMembership } from "@/api/shifts";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { WorkerCredentialBadge } from "./WorkerCredentialBadge";
import { formatCredentialDate } from "./workerCredentialUtils";

export function AgencyWorkerProfilePage() {
  const { membershipId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [worker, setWorker] = useState<WorkerMembership | null | undefined>(undefined);
  const [credentials, setCredentials] = useState<WorkerCredentialSummary[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !token) return;
    setError(false);
    try {
      const [workers, profile] = await Promise.all([
        listWorkers(organizationId, token),
        getWorkerProfile(organizationId, membershipId, token),
      ]);
      setWorker(workers.find((row) => row.id === membershipId) ?? null);
      setCredentials(profile.credentialsSummary);
    } catch {
      setWorker(null);
      setError(true);
    }
  }, [membershipId, organizationId]);

  useEffect(() => { void load(); }, [load]);

  if (worker === undefined) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-56" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!worker) return <ErrorState kind="not_found" />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate("/agency/workers")} className="self-start">Volver a cuidadores</Button>
      <PageHeader
        title={worker.display_name || "Cuidador sin nombre"}
        description="Información laboral y credenciales verificadas."
        actions={<Badge tone={worker.status === "active" ? "success" : "neutral"}>{worker.status === "active" ? "Activo" : "Inactivo"}</Badge>}
      />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BriefcaseBusiness size={20} className="text-[var(--color-text-muted)]" aria-hidden />
          <h2 className="font-medium text-[var(--color-text-primary)]">Información laboral</h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Rol interno" value={worker.internal_role} />
          <Detail label="Estado" value={worker.status === "active" ? "Activo" : "Inactivo"} />
          <Detail label="Fecha de contratación" value={worker.hired_at ? formatCredentialDate(worker.hired_at.slice(0, 10)) : "No registrada"} />
          {worker.ended_at && <Detail label="Fecha de finalización" value={new Date(worker.ended_at).toLocaleDateString("es-PR")} />}
        </dl>
      </Card>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={21} className="text-[var(--color-text-muted)]" aria-hidden />
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Credenciales</h2>
        </div>
        {credentials.length === 0 ? (
          <EmptyState title="Sin credenciales registradas" />
        ) : (
          <div className="flex flex-col gap-2">
            {credentials.map((credential) => (
              <Card key={credential.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{credential.type_code}</p>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">{credential.expires_at ? `Expira ${formatCredentialDate(credential.expires_at)}` : "Sin fecha de expiración"}</p>
                </div>
                <WorkerCredentialBadge credential={credential} />
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</dt><dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{value}</dd></div>;
}
