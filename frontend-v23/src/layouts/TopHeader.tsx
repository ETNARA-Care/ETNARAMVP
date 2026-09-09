import { Avatar } from "@/components/ui";
import { NotificationBell } from "@/features/notifications/NotificationBell";

interface TopHeaderProps {
  title: string;
  userName: string;
}

/** Header compacto móvil: máximo dos toques para llegar a cualquier acción global (perfil, notificaciones). */
export function TopHeader({ title, userName }: TopHeaderProps) {
  return (
    <header
      className="sticky top-0 z-[var(--z-header)] flex items-center justify-between h-14 px-[var(--spacing-md)]
        bg-[var(--color-bg)]/90 backdrop-blur border-b border-[var(--color-border)]"
    >
      <span className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{title}</span>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <Avatar name={userName} size={32} />
      </div>
    </header>
  );
}
