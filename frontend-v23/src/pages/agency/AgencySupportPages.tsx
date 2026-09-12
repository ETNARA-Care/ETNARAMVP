import { PageHeader, EmptyState, Card, Badge, StatusBadge, Button, ErrorState, Skeleton } from "@/components/ui";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, LogOut, Settings, ShieldCheck, UserCheck } from "lucide-react";
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
import { WorkerCredentialBadge } from "./WorkerCredentialBadge";
import {
  getWorkerCompliance,
  type ComplianceRequirement,
  type ComplianceSummary,
} from "@/api/compliance";

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
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [rows, setRows] = useState<ComplianceWorker[] | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const memberships = await listWorkers(organizationId, token);
      const details = await Promise.all(memberships.map(async (membership) => {
        const [profile, compliance] = await Promise.all([
          getWorkerProfile(organizationId, membership.id, token),
          getWorkerCompliance(organizationId, membership.id, token),
        ]);
        return { ...membership, credentials: profile.credentialsSummary, compliance };
      }));
      setRows(details);
    } catch {
      setRows([]);
      setError(true);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  if (rows === null) return <div className="flex flex-col gap-3"><Skeleton className="h-28" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  const activeRows = rows.filter((row) => row.status === "active");
  const eligibleCount = activeRows.filter((row) => complianceTone(row) === "success").length;
  const attentionCount = activeRows.length - eligibleCount;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Cumplimiento" description="Credenciales y verificaciones del equipo." />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ComplianceMetric icon={<UserCheck size={20} />} label="Personal activo" value={activeRows.length} />
        <ComplianceMetric icon={<ShieldCheck size={20} />} label="Aptos" value={eligibleCount} tone="success" />
        <ComplianceMetric icon={<AlertTriangle size={20} />} label="Requieren atención" value={attentionCount} tone={attentionCount > 0 ? "warning" : "success"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={28} />} title="No hay cuidadores para evaluar" description="Añade personal a la organización para ver su cumplimiento." />
      ) : (
        <section aria-label="Cumplimiento por cuidador" className="flex flex-col gap-2">
          {rows.map((row) => {
            const isExpanded = expanded === row.id;
            return (
              <Card key={row.id} className="p-0 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 p-[var(--spacing-md)] text-left"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : row.id)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)]">{row.display_name || "Cuidador sin nombre"}</p>
                    <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{complianceSummaryText(row)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={complianceTone(row)}>{complianceLabel(row)}</Badge>
                    <ChevronDown size={20} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden />
                  </div>
                </button>

                {isExpanded && <ComplianceDetails row={row} />}
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}

type ComplianceWorker = WorkerMembership & {
  credentials: WorkerCredentialSummary[];
  compliance: ComplianceSummary;
};

function ComplianceMetric({ icon, label, value, tone = "neutral" }: { icon: ReactNode; label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-[var(--color-success-700)]" : tone === "warning" ? "text-[var(--color-warning-700)]" : "text-[var(--color-text-muted)]";
  return <Card className="flex items-center gap-3"><span className={toneClass}>{icon}</span><div><p className="text-[var(--text-h3)] font-semibold text-[var(--color-text-primary)]">{value}</p><p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{label}</p></div></Card>;
}

function complianceTone(row: ComplianceWorker): "success" | "warning" | "neutral" {
  if (row.status !== "active") return "neutral";
  const hasCredentialAlert = row.credentials.some((credential) => credentialState(credential) !== "active");
  return row.compliance.eligibility === "eligible" && !hasCredentialAlert ? "success" : "warning";
}

function complianceLabel(row: ComplianceWorker): string {
  if (row.status !== "active") return "Inactivo";
  return complianceTone(row) === "success" ? "Al día" : "Atención";
}

function complianceSummaryText(row: ComplianceWorker): string {
  if (row.status !== "active") return "Membresía inactiva";
  const alerts = row.credentials.filter((credential) => credentialState(credential) !== "active").length;
  const missing = row.compliance.requirements.filter((requirement) => requirement.status !== "satisfied").length;
  if (missing > 0) return `${missing} requisito${missing === 1 ? "" : "s"} pendiente${missing === 1 ? "" : "s"}`;
  if (alerts > 0) return `${alerts} alerta${alerts === 1 ? "" : "s"} de credenciales`;
  return "Requisitos y credenciales al día";
}

function ComplianceDetails({ row }: { row: ComplianceWorker }) {
  const navigate = useNavigate();
  const credentialAlerts = row.credentials.filter((credential) => credentialState(credential) !== "active");
  return (
    <div className="border-t border-[var(--color-ivory-300)] px-[var(--spacing-md)] pb-[var(--spacing-md)] pt-4">
      <h3 className="font-medium text-[var(--color-text-primary)] mb-2">Requisitos</h3>
      {row.compliance.requirements.length === 0 ? (
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">No hay requisitos obligatorios configurados para esta organización.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {row.compliance.requirements.map((requirement) => <RequirementRow key={requirement.requirement} requirement={requirement} />)}
        </div>
      )}

      <h3 className="font-medium text-[var(--color-text-primary)] mb-2 mt-4">Alertas de credenciales</h3>
      {credentialAlerts.length === 0 ? (
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">No hay credenciales vencidas, revocadas o próximas a vencer.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {credentialAlerts.map((credential) => (
            <li key={credential.id} className="flex items-center justify-between gap-3 text-[var(--text-small)]">
              <span className="text-[var(--color-text-primary)]">{formatRequirementName(credential.type_code)}</span>
              <WorkerCredentialBadge credential={credential} />
            </li>
          ))}
        </ul>
      )}

      <Button variant="secondary" className="mt-4" onClick={() => navigate(`/agency/workers/${row.id}`)}>Ver perfil completo</Button>
    </div>
  );
}

function RequirementRow({ requirement }: { requirement: ComplianceRequirement }) {
  const satisfied = requirement.status === "satisfied";
  return (
    <div className="flex items-center justify-between gap-3 text-[var(--text-small)]">
      <div>
        <p className="text-[var(--color-text-primary)]">{formatRequirementName(requirement.requirement)}</p>
        {requirement.requiresOrganizationReview && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Requiere aprobación de la agencia</p>}
      </div>
      <Badge tone={satisfied ? "success" : "warning"}>{requirementStatusLabel(requirement.status)}</Badge>
    </div>
  );
}

function requirementStatusLabel(status: ComplianceRequirement["status"]): string {
  const labels: Record<ComplianceRequirement["status"], string> = {
    satisfied: "Cumple",
    MISSING_CREDENTIAL: "Falta credencial",
    CREDENTIAL_NOT_ACTIVE: "No activa",
    CREDENTIAL_EXPIRED: "Vencida",
    PLATFORM_VERIFICATION_MISSING: "Verificación pendiente",
    ORGANIZATION_REVIEW_MISSING: "Revisión pendiente",
  };
  return labels[status];
}

function formatRequirementName(value: string): string {
  return value.replaceAll("_", " ");
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
