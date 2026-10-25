import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, Building2, CalendarRange, Home, MessageCircle, MoreHorizontal } from "lucide-react";
import { PortalBottomNav } from "./PortalBottomNav";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { CareEventQueueBanner, CareEventQueueProvider } from "@/features/caregiver/CareEventQueueProvider";
import { useCareEventQueue } from "@/features/caregiver/careEventQueue";
import { AppLockGate } from "@/features/caregiver/AppLock";
import { useAuth } from "@/auth/AuthProvider";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { getToken } from "@/auth/token";
import { listMyEstablishmentAdminAssignments, type MyEstablishmentAdminAssignment } from "@/api/establishments";

/** Menú de la cuenta: avisa antes de cerrar sesión si hay registros sin enviar (se perderían). */
function CaregiverAccountMenu({ userLabel }: { userLabel: string }) {
  const { logout, organizations } = useAuth();
  const { items } = useCareEventQueue();
  const pending = items.filter((item) => item.status !== "failed").length;
  const { t } = useTranslation("shell");
  return (
    <AccountMenu userLabel={userLabel} roleLabel={t("roles.caregiver")} settingsTo="/caregiver/profile" onLogout={logout}
      canSwitchOrganization={organizations.length > 1} showDetailsFrom="never"
      logoutWarning={pending > 0 ? t("caregiver.logoutWarning", { count: pending }) : null} />
  );
}

export function CaregiverLayout() {
  const { activeOrganization, activeWorkerProfile, user, roles } = useAuth();
  const smartMatch = hasOrgFeature(activeOrganization?.features, "SMARTMATCH");
  const alsoStaff = roles.includes("ORGANIZATION_ADMIN") || roles.includes("SUPERVISOR");
  const { t } = useTranslation("shell");
  const caregiverName = activeWorkerProfile?.displayName ?? user?.email ?? t("caregiver.nameFallback");
  const navigate = useNavigate();
  const [adminEstablishments, setAdminEstablishments] = useState<MyEstablishmentAdminAssignment[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token || !activeOrganization) return;
    listMyEstablishmentAdminAssignments(activeOrganization.id, token)
      .then((result) => setAdminEstablishments(result.establishments))
      .catch(() => setAdminEstablishments([]));
  }, [activeOrganization]);

  return <CareEventQueueProvider><AppLockGate><div data-portal="caregiver" className="min-h-dvh bg-[var(--color-ivory-50)] text-[var(--color-text-primary)]">
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)]/70 bg-[var(--color-ivory-50)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[760px] items-center gap-3 px-4 sm:px-6">
        <img src="/etnara-mark.svg" alt="" className="h-9 w-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-text-secondary)]">{activeOrganization?.name ?? "ETNARA Care"}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{t("caregiver.portalOf", { name: caregiverName })}</p>
        </div>
        <NotificationBell />
        <CaregiverAccountMenu userLabel={user?.email ?? caregiverName} />
      </div>
    </header>

    <CareEventQueueBanner />

    {alsoStaff && <div className="mx-auto w-full max-w-[760px] px-4 pt-4 sm:px-6">
      <button type="button" className="w-full rounded-2xl border border-[var(--color-border)] bg-white p-4 text-left shadow-sm" onClick={() => navigate("/agency")}>
        <div className="flex items-center gap-3"><Building2 size={22}/><div><div className="font-semibold">{t("caregiver.goToAgency")}</div><div className="text-sm text-[var(--color-text-secondary)]">{t(roles.includes("ORGANIZATION_ADMIN") ? "caregiver.alsoAdmin" : "caregiver.alsoSupervisor", { organization: activeOrganization?.name ?? t("caregiver.theAgency") })}</div></div></div>
      </button>
    </div>}

    {adminEstablishments.length > 0 && <div className="mx-auto w-full max-w-[760px] px-4 pt-4 sm:px-6">
      <button type="button" className="w-full rounded-2xl border border-[var(--color-border)] bg-white p-4 text-left shadow-sm" onClick={() => navigate(`/caregiver/admin/establishments/${adminEstablishments[0].id}`)}>
        <div className="flex items-center gap-3"><Building2 size={22}/><div><div className="font-semibold">{t("caregiver.manageEstablishment", { name: adminEstablishments[0].name })}</div><div className="text-sm text-[var(--color-text-secondary)]">{t("caregiver.establishmentAccess")}</div></div></div>
      </button>
    </div>}

    <main className="mx-auto w-full max-w-[760px] px-4 py-5 pb-28 sm:px-6"><Outlet/></main>

    <PortalBottomNav tabs={[
      { to: "/caregiver/today", icon: Home, label: t("caregiver.items.today") },
      { to: "/caregiver/shifts", icon: CalendarRange, label: t("caregiver.items.shifts") },
      ...(smartMatch ? [{ to: "/caregiver/smartmatch", icon: BriefcaseBusiness, label: t("caregiver.items.offers") }] : []),
      { to: "/caregiver/messages", icon: MessageCircle, label: t("caregiver.items.messages") },
      { to: "/caregiver/profile", icon: MoreHorizontal, label: t("caregiver.items.more") },
    ]}/>
  </div></AppLockGate></CareEventQueueProvider>;
}
