import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight, Building2 } from "lucide-react";
import { AccountMenu } from "@/layouts/AccountMenu";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { AdminLogo } from "@/components/admin/AdminUI";

export function AdminTopbar({ organizationName, canSwitchOrganization, userLabel, onLogout }: {
 organizationName: string; canSwitchOrganization: boolean; userLabel: string; onLogout: () => Promise<void>;
}) {
 const { t } = useTranslation("shell");
 return (
 <header className="sticky top-0 z-[var(--z-header)] border-b border-[var(--color-border)]/70 bg-[var(--color-bg)]/85 backdrop-blur-md">
 <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:px-6 lg:px-10">
 <Link to="/agency" className="shrink-0 lg:hidden" aria-label={t("agency.homeLink")}><AdminLogo /></Link>
 <div className="hidden min-w-0 flex-1 items-center gap-2.5 px-1 sm:flex">
 <span className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-success-100)] text-[var(--color-success-700)] sm:grid"><Building2 size={16} aria-hidden /></span>
 <div className="min-w-0">
 <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{organizationName}</p>
 <p className="hidden truncate text-xs text-[var(--color-text-muted)] sm:block">{t("agency.workspace")}</p>
 </div>
 {canSwitchOrganization && (
 <Link to="/select-organization" className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-text-primary)]/5 hover:text-[var(--color-text-primary)] md:inline-flex">
 <ArrowLeftRight size={14} aria-hidden />{t("account.switchOrganization")}
 </Link>
 )}
 </div>
 {/* Phones: the organisation block above is hidden, so this spacer keeps the bell and the
     account menu at the right edge (as in the Family and Caregiver headers). Without it they sat
     next to the logo and the right-aligned notification panel opened off the left of the screen. */}
 <div className="flex-1 sm:hidden" aria-hidden />
 <NotificationBell />
 <AccountMenu userLabel={userLabel} roleLabel={t("roles.admin")} settingsTo="/agency/settings" onLogout={onLogout} canSwitchOrganization={canSwitchOrganization} />
 </div>
 </header>
 );
}
