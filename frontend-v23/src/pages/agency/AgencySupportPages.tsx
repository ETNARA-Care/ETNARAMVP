import { PageHeader, EmptyState, Card, Badge, StatusBadge, Button, ErrorState, Skeleton } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  getWorkerProfile,
  listWorkers,
  recipientName,
  type WorkerCredentialSummary,
  type WorkerMembership,
} from "@/api/shifts";
import { isToday, useAgencySupervision, type AdminShift } from "@/features/agency/useAgencySupervision";
import { credentialState } from "./workerCredentialUtils";

export function AgencyResidentsPage() {
  const { loading, error, recipients, shifts, reload } = useAgencySupervision();
  if (loading) return <div className="flex flex-col gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void reload()} />;
  return (
    <div>
      <PageHeader title="Residentes" description="Vista real de residentes, turnos de hoy y equipo asignado." />
      {recipients.length === 0 ? <EmptyState title="No hay residentes registrados" /> : (
        <div className="flex flex-col gap-2">
          {recipients.map((recipient) => (
            <ResidentRow key={recipient.id} id={recipient.id} name={recipientName(recipient)} shift={shiftForRecipientToday(shifts, recipient.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function shiftForRecipientToday(shifts: AdminShift[], recipientId: string): AdminShift | undefined {
  const rows = shifts.filter((shift) => shift.care_recipient_id === recipientId && isToday(shift.scheduled_start));
  return rows.find((shift) => shift.status === "in_progress")
    ?? rows.find((shift) => shift.status === "confirmed")
    ?? rows.find((shift) => shift.status === "unassigned")
    ?? rows.sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())[0];
}

function ResidentRow({ id, name, shift }: { id: string; name: string; shift?: AdminShift }) {
  const navigate = useNavigate();
  const workerName = shift?.caregiver?.display_name ?? shift?.caregiver?.internal_role;
  return (
    <button type="button" className="text-left" onClick={() => navigate(`/agency/residents/${id}`)}>
    <Card className="flex items-center justify-between hover:bg-[var(--color-ivory-100)] transition-colors">
      <div>
        <p className="font-medium text-[var(--color-text-primary)]">{name}</p>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {workerName ? `Cuidadora: ${workerName}` : shift ? "Sin cuidadora asignada" : "Sin turno programado hoy"}
        </p>
      </div>
      {shift && <StatusBadge status={shift.status} />}
    </Card>
    </button>
  );
}

export function AgencyWorkersPage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [workers, setWorkers] = useState<Array<WorkerMembership & { credentials: WorkerCredentialSummary[] }> | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const memberships = await listWorkers(organizationId, token);
      const profiles = await Promise.all(
        memberships.map((membership) => getWorkerProfile(organizationId, membership.id, token)),
      );
      const credentialsByMembership = new Map(
        profiles.map((profile) => [profile.membership.id, profile.credentialsSummary]),
      );
      setWorkers(memberships.map((membership) => ({
        ...membership,
        credentials: credentialsByMembership.get(membership.id) ?? [],
      })));
    } catch {
      setWorkers([]);
      setError(true);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  if (workers === null) {
    return <div className="flex flex-col gap-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  }
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  return (
    <div>
      <PageHeader title="Cuidadores" description="Estado real de membresía y credenciales del equipo." />
      {workers.length === 0 ? <EmptyState title="No hay cuidadores registrados" /> : (
        <div className="flex flex-col gap-3">
          {workers.map((worker) => <WorkerCard key={worker.id} worker={worker} />)}
        </div>
      )}
    </div>
  );
}

function WorkerCard({ worker }: { worker: WorkerMembership & { credentials: WorkerCredentialSummary[] } }) {
  const navigate = useNavigate();
  const expiringCount = worker.credentials.filter((credential) => credentialState(credential) === "expiring").length;
  const expiredCount = worker.credentials.filter((credential) => credentialState(credential) === "expired").length;
  const revokedCount = worker.credentials.filter((credential) => credentialState(credential) === "revoked").length;

  const warning = expiredCount > 0
    ? `${expiredCount} credencial${expiredCount === 1 ? "" : "es"} vencida${expiredCount === 1 ? "" : "s"}`
    : revokedCount > 0
      ? `${revokedCount} credencial${revokedCount === 1 ? "" : "es"} revocada${revokedCount === 1 ? "" : "s"}`
      : expiringCount > 0
        ? `${expiringCount} credencial${expiringCount === 1 ? "" : "es"} por vencer`
        : worker.credentials.length > 0 ? "Credenciales al día" : "Sin credenciales registradas";

  return (
    <button type="button" className="text-left" onClick={() => navigate(`/agency/workers/${worker.id}`)}>
    <Card className="flex items-center justify-between gap-3 hover:bg-[var(--color-ivory-100)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text-primary)]">
            {worker.display_name || "Cuidador sin nombre"}
          </p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{worker.internal_role}</p>
          <p className={`text-[var(--text-caption)] mt-1 ${expiredCount || revokedCount ? "text-[var(--color-danger-700)]" : expiringCount ? "text-[var(--color-warning-700)]" : "text-[var(--color-text-muted)]"}`}>{warning}</p>
        </div>
      </div>
      <Badge tone={worker.status === "active" ? "success" : "neutral"}>
        {worker.status === "active" ? "Activo" : "Inactivo"}
      </Badge>
    </Card>
    </button>
  );
}

export function AgencyMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensajes" />
      <RealMessagingPanel />
    </div>
  );
}

export function AgencyCompliancePage() {
  return (
    <div>
      <PageHeader title="Cumplimiento" description="Credenciales y verificaciones del equipo." />
      <EmptyState icon={<ShieldCheck size={28} />} title="Sin datos de cumplimiento todavía" description="Se conecta a /credentials y /eligibility en Fase 3." />
    </div>
  );
}

export function AgencySettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Configuración" />
      <EmptyState icon={<Settings size={28} />} title="Configuración de la organización" description="Pendiente de endpoints de organización." />
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">Sesión activa</p>
          {user?.email && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{user.email}</p>}
        </div>
        <Button variant="secondary" icon={<LogOut size={18} />} onClick={onLogout}>Cerrar sesión</Button>
      </Card>
    </div>
  );
}
