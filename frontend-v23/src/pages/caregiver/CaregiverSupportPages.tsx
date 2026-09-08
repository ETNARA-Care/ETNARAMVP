import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, Avatar, Badge, Button, Skeleton } from "@/components/ui";
import { CheckCircle2, LogOut, ShieldCheck } from "lucide-react";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listMyCredentials, type CredentialSummary } from "@/api/credentials";

function credentialState(credential: CredentialSummary): { tone: "success" | "warning" | "danger"; label: string } {
  if (credential.status === "expired") return { tone: "danger", label: "Vencida" };
  if (credential.verificationStatus === "rejected") return { tone: "danger", label: "Rechazada" };
  if (credential.verificationStatus === "pending") return { tone: "warning", label: "Pendiente" };
  if (credential.expiresAt) {
    const days = Math.ceil((new Date(`${credential.expiresAt}T23:59:59`).getTime() - Date.now()) / 86_400_000);
    if (days <= 60) return { tone: "warning", label: "Por vencer" };
  }
  return { tone: "success", label: "Vigente" };
}

export function CaregiverMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensajes" />
      <RealMessagingPanel />
    </div>
  );
}

export function CaregiverProfilePage() {
  const { user, activeOrganization, logout } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<CredentialSummary[] | null>(null);
  const [credentialError, setCredentialError] = useState(false);

  const loadCredentials = useCallback(async () => {
    const token = getToken();
    if (!token || !activeOrganization) return;
    setCredentialError(false);
    try {
      setCredentials(await listMyCredentials(activeOrganization.id, token));
    } catch {
      setCredentialError(true);
      setCredentials([]);
    }
  }, [activeOrganization]);

  useEffect(() => { void loadCredentials(); }, [loadCredentials]);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Perfil" />
      <Card className="flex items-center gap-3">
        <Avatar name="María Rivera" size={48} />
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">María Rivera</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Cuidadora certificada</p>
          {user?.email && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">Sesión: {user.email}</p>}
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[var(--color-success-700)]" />
            <p className="font-medium text-[var(--color-text-primary)]">Mis credenciales</p>
          </div>
          {credentials && credentials.some((item) => item.verificationStatus === "verified") && <Badge tone="success">Verificada</Badge>}
        </div>
        {credentials === null ? <Skeleton className="h-24" /> : credentialError ? (
          <button className="text-[var(--text-small)] text-[var(--color-danger-700)]" onClick={() => void loadCredentials()}>No pudimos cargar las credenciales. Toca para reintentar.</button>
        ) : credentials.length === 0 ? (
          <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay credenciales registradas todavía.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {credentials.map((credential) => {
              const state = credentialState(credential);
              return (
                <div key={credential.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                  <CheckCircle2 size={18} className="text-[var(--color-success-700)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">{credential.typeName}</p>
                    {credential.expiresAt && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Vence {new Date(`${credential.expiresAt}T00:00:00`).toLocaleDateString("es-PR")}</p>}
                  </div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Button variant="secondary" icon={<LogOut size={18} />} onClick={onLogout}>Cerrar sesión</Button>
    </div>
  );
}
