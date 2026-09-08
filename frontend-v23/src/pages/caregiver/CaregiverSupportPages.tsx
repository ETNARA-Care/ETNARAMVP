import { useNavigate } from "react-router-dom";
import { PageHeader, Card, Avatar, Button } from "@/components/ui";
import { LogOut } from "lucide-react";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";
import { useAuth } from "@/auth/AuthProvider";

export function CaregiverMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensajes" />
      <RealMessagingPanel />
    </div>
  );
}

export function CaregiverProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      <Button variant="secondary" icon={<LogOut size={18} />} onClick={onLogout}>Cerrar sesión</Button>
    </div>
  );
}
