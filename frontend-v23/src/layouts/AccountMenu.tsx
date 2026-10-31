import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Languages, LogOut, Settings, TriangleAlert } from "lucide-react";
import { Avatar } from "@/components/ui";

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return ref;
}

/**
 * Menú de la cuenta desde el encabezado (avatar), igual en los tres portales:
 * Configuración y Cerrar sesión (y Cambiar organización si hay varias).
 * `logoutWarning`: si hay algo pendiente (p. ej. registros sin enviar), se pide
 * confirmación antes de cerrar la sesión. Con `onDiscardAndLogout` (C3) se ofrece
 * además descartarlo, con una segunda confirmación; por defecto se conserva.
 */
export function AccountMenu({ userLabel, roleLabel, settingsTo, onLogout, canSwitchOrganization = false, logoutWarning, onDiscardAndLogout, showDetailsFrom = "xl" }: {
  userLabel: string;
  roleLabel: string;
  settingsTo: string;
  onLogout: () => Promise<void>;
  canSwitchOrganization?: boolean;
  logoutWarning?: string | null;
  onDiscardAndLogout?: () => Promise<void>;
  showDetailsFrom?: "xl" | "never";
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const close = () => { setOpen(false); setConfirming(false); setDiscarding(false); };
  const ref = useDismiss(open, close);
  const navigate = useNavigate();
  const { t } = useTranslation("shell");
  const item = "flex min-h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm";

  function logout() {
    if (logoutWarning && !confirming) { setConfirming(true); return; }
    close();
    void onLogout();
  }

  function discardAndLogout() {
    if (!onDiscardAndLogout) return;
    if (!discarding) { setDiscarding(true); return; }
    close();
    void onDiscardAndLogout();
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-haspopup="menu" aria-label={t("account.menu")}
        className={`flex items-center gap-2.5 rounded-[10px] p-1 hover:bg-[var(--color-text-primary)]/5 ${showDetailsFrom === "xl" ? "xl:pr-2.5" : ""}`}>
        <Avatar name={userLabel} size={34} />
        {showDetailsFrom === "xl" && (
          <span className="hidden max-w-[180px] text-left leading-tight xl:block">
            <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">{userLabel}</span>
            <span className="block text-xs text-[var(--color-text-muted)]">{roleLabel}</span>
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-[var(--z-overlay)] mt-2 w-[min(280px,calc(100vw-2rem))] rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-raised)]">
          <p className="truncate px-3 pb-2 pt-2 text-xs text-[var(--color-text-muted)]">{userLabel}</p>
          {canSwitchOrganization && (
            <button role="menuitem" type="button" onClick={() => { close(); navigate("/select-organization"); }} className={`${item} hover:bg-[var(--color-ivory-100)] md:hidden`}>
              <ArrowLeftRight size={16} aria-hidden />{t("account.switchOrganization")}
            </button>
          )}
          <button role="menuitem" type="button" onClick={() => { close(); navigate(settingsTo); }} className={`${item} hover:bg-[var(--color-ivory-100)]`}>
            <Settings size={16} aria-hidden />{t("account.settings")}
          </button>
          {/* Language: changes at once, stays chosen on this device (also after signing out). */}
          <div className="flex min-h-11 items-center justify-between gap-3 px-3 text-sm text-[var(--color-text-secondary)]" data-testid="account-language">
            <span className="flex items-center gap-3"><Languages size={16} aria-hidden />{t("account.language")}</span>
            <LanguageSwitcher tone="light" />
          </div>
          {confirming && logoutWarning && (
            <p role="alert" className="mx-1 my-1 flex gap-2 rounded-[10px] bg-[var(--color-warning-100,#fdf3dc)] p-2.5 text-xs text-[var(--color-warning-700,#8a5a00)]">
              <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />{logoutWarning}
            </p>
          )}
          <button role="menuitem" type="button" onClick={logout} className={`${item} text-[var(--color-danger-700)] hover:bg-[var(--color-danger-100)]`}>
            <LogOut size={16} aria-hidden />{confirming ? (onDiscardAndLogout ? t("account.confirmLogoutKeep") : t("account.confirmLogout")) : t("account.logout")}
          </button>
          {confirming && logoutWarning && onDiscardAndLogout && (
            <>
              {discarding && <p role="alert" className="mx-1 my-1 rounded-[10px] bg-[var(--color-danger-100)] p-2.5 text-xs text-[var(--color-danger-700)]">{t("account.discardWarning")}</p>}
              <button role="menuitem" type="button" data-testid="discard-and-logout" onClick={discardAndLogout} className={`${item} text-[var(--color-text-secondary)] hover:bg-[var(--color-ivory-100)]`}>
                <TriangleAlert size={16} aria-hidden />{discarding ? t("account.confirmDiscard") : t("account.discardAndLogout")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
