import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Building2, CalendarRange, Home, MessageCircle, MoreHorizontal } from "lucide-react";
import { MobileTabBar } from "./MobileTabBar";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listMyEstablishmentAdminAssignments, type MyEstablishmentAdminAssignment } from "@/api/establishments";

export function CaregiverLayout() {
  const { activeOrganization, activeWorkerProfile, user } = useAuth();
  const caregiverName = activeWorkerProfile?.displayName ?? user?.email ?? "Cuidador/a";
  const navigate = useNavigate();
  const [adminEstablishments, setAdminEstablishments] = useState<MyEstablishmentAdminAssignment[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token || !activeOrganization) return;
    listMyEstablishmentAdminAssignments(activeOrganization.id, token)
      .then((result) => setAdminEstablishments(result.establishments))
      .catch(() => setAdminEstablishments([]));
  }, [activeOrganization]);

  return <div data-portal="caregiver" className="min-h-dvh bg-[var(--color-ivory-50)] text-[var(--color-text-primary)]">
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)]/70 bg-[var(--color-ivory-50)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[760px] items-center gap-3 px-4 sm:px-6">
        <img src="/etnara-mark.svg" alt="" className="h-9 w-9 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-text-secondary)]">{activeOrganization?.name ?? "ETNARA Care"}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">Portal del cuidador · {caregiverName}</p>
        </div>
      </div>
    </header>

    {adminEstablishments.length > 0 && <div className="mx-auto w-full max-w-[760px] px-4 pt-4 sm:px-6">
      <button type="button" className="w-full rounded-2xl border border-[var(--color-border)] bg-white p-4 text-left shadow-sm" onClick={() => navigate(`/caregiver/admin/establishments/${adminEstablishments[0].id}`)}>
        <div className="flex items-center gap-3"><Building2 size={22}/><div><div className="font-semibold">Administrar {adminEstablishments[0].name}</div><div className="text-sm text-[var(--color-text-secondary)]">Acceso de administrador del establecimiento</div></div></div>
      </button>
    </div>}

    <main className="mx-auto w-full max-w-[760px] px-4 py-5 pb-28 sm:px-6"><Outlet/></main>

    <MobileTabBar items={[
      { to: "/caregiver/today", icon: <Home size={21}/>, label: "Mi día" },
      { to: "/caregiver/shifts", icon: <CalendarRange size={21}/>, label: "Turnos" },
      { to: "/caregiver/messages", icon: <MessageCircle size={21}/>, label: "Mensajes" },
      { to: "/caregiver/profile", icon: <MoreHorizontal size={21}/>, label: "Más" },
    ]}/>
  </div>;
}
