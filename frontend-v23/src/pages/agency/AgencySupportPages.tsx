import { PageHeader, EmptyState, Card, Badge, StatusBadge, Button, ErrorState, Skeleton } from "@/components/ui";
import { ShieldCheck, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";
import { useWorkers } from "@/mocks/DemoStoreContext";
import { useAuth } from "@/auth/AuthProvider";
import { recipientName } from "@/api/shifts";
import { isToday, useAgencySupervision, type AdminShift } from "@/features/agency/useAgencySupervision";

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
  const workers = useWorkers();
  return (
    <div>
      <PageHeader title="Cuidadores" description="Estado y disponibilidad del equipo (demo)." />
      <div className="flex flex-col gap-2">
        {workers.map((w) => (
          <Card key={w.id} className="flex items-center justify-between">
            <p className="font-medium text-[var(--color-text-primary)]">{w.name}</p>
            <div className="flex gap-2">
              <Badge tone={w.available ? "success" : "neutral"}>{w.available ? "Disponible" : "No disponible"}</Badge>
              {w.credentialStatus !== "active" && <Badge tone="warning">Credencial por vencer</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
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
