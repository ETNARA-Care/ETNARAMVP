import type { ReactNode } from "react";
import { BottomNavItem } from "@/components/ui";

interface TabDef {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
  badge?: number;
}

export function MobileTabBar({ items }: { items: TabDef[] }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 h-16 bg-[var(--color-surface)] border-t border-[var(--color-border)]
        flex items-stretch z-[var(--z-nav)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item) => (
        <BottomNavItem key={item.to} {...item} />
      ))}
    </nav>
  );
}
