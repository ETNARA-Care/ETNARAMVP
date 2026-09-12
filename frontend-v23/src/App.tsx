import { Routes, Route, Navigate } from "react-router-dom";
import { DemoLandingPage } from "@/pages/DemoLandingPage";
import { RootRedirect } from "@/pages/RootRedirect";
import { LoginPage } from "@/pages/LoginPage";
import { SelectOrganizationPage } from "@/pages/SelectOrganizationPage";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { RoleGuard } from "@/auth/RoleGuard";

import { FamilyLayout } from "@/layouts/FamilyLayout";
import { FamilyTodayPage } from "@/pages/family/FamilyTodayPage";
import { FamilyMessagesPage } from "@/pages/family/FamilyMessagesPage";
import { FamilyHistoryPage } from "@/pages/family/FamilyHistoryPage";
import {
  FamilyActivityPage,
  FamilyProfilePage,
  FamilyNotificationsPage,
} from "@/pages/family/FamilySupportPages";

import { CaregiverLayout } from "@/layouts/CaregiverLayout";
import { CaregiverShiftsPage } from "@/pages/caregiver/CaregiverShiftsPage";
import { CaregiverShiftDetailPage } from "@/pages/caregiver/CaregiverShiftDetailPage";
import { CaregiverMessagesPage, CaregiverProfilePage } from "@/pages/caregiver/CaregiverSupportPages";

import { AgencyLayout } from "@/layouts/AgencyLayout";
import { AgencyOverviewPage } from "@/pages/agency/AgencyOverviewPage";
import { AgencyShiftsPage } from "@/pages/agency/AgencyShiftsPage";
import { AgencyShiftDetailPage } from "@/pages/agency/AgencyShiftDetailPage";
import { AgencyWorkerProfilePage } from "@/pages/agency/AgencyWorkerProfilePage";
import { AgencyIncidentsPage } from "@/pages/agency/AgencyIncidentsPage";
import { AgencyIncidentDetailPage } from "@/pages/agency/AgencyIncidentDetailPage";
import { AgencyResidentProfilePage } from "@/pages/agency/AgencyResidentProfilePage";
import { FamilyIncidentDetailPage } from "@/pages/family/FamilyIncidentDetailPage";
import {
  AgencyResidentsPage,
  AgencyWorkersPage,
  AgencyMessagesPage,
  AgencyCompliancePage,
  AgencySettingsPage,
} from "@/pages/agency/AgencySupportPages";

/**
 * Fase 3: /family, /caregiver, /agency ahora viven dentro de
 * <ProtectedRoute> (requiere sesión real -- ver src/auth/ProtectedRoute.tsx)
 * y cada rama dentro de <RoleGuard experience="..."> (requiere el rol real
 * correspondiente en la organización activa -- ver src/auth/RoleGuard.tsx).
 * Las fuentes de datos son mixtas durante la consolidación de Fase 4.5.
 * `docs/FRONTEND_DATA_AUDIT.md` enumera cada superficie real, simulada o
 * pendiente. Las superficies reales fallan visiblemente y nunca recurren al
 * DemoStore como sustituto silencioso.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/demo" element={<DemoLandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/select-organization" element={<SelectOrganizationPage />} />

        <Route
          path="/family"
          element={
            <RoleGuard experience="/family">
              <FamilyLayout />
            </RoleGuard>
          }
        >
          <Route index element={<Navigate to="today" replace />} />
          <Route path="today" element={<FamilyTodayPage />} />
          <Route path="activity" element={<FamilyActivityPage />} />
          <Route path="history" element={<FamilyHistoryPage />} />
          <Route path="messages" element={<FamilyMessagesPage />} />
          <Route path="profile" element={<FamilyProfilePage />} />
          <Route path="notifications" element={<FamilyNotificationsPage />} />
          <Route path="incidents/:incidentId" element={<FamilyIncidentDetailPage />} />
        </Route>

        <Route
          path="/caregiver"
          element={
            <RoleGuard experience="/caregiver">
              <CaregiverLayout />
            </RoleGuard>
          }
        >
          <Route index element={<Navigate to="shifts" replace />} />
          <Route path="shifts" element={<CaregiverShiftsPage />} />
          <Route path="shifts/:shiftId" element={<CaregiverShiftDetailPage />} />
          <Route path="messages" element={<CaregiverMessagesPage />} />
          <Route path="profile" element={<CaregiverProfilePage />} />
        </Route>

        <Route
          path="/agency"
          element={
            <RoleGuard experience="/agency">
              <AgencyLayout />
            </RoleGuard>
          }
        >
          <Route index element={<AgencyOverviewPage />} />
          <Route path="residents" element={<AgencyResidentsPage />} />
          <Route path="residents/:residentId" element={<AgencyResidentProfilePage />} />
          <Route path="workers" element={<AgencyWorkersPage />} />
          <Route path="workers/:membershipId" element={<AgencyWorkerProfilePage />} />
          <Route path="shifts" element={<AgencyShiftsPage />} />
          <Route path="shifts/:shiftId" element={<AgencyShiftDetailPage />} />
          <Route path="incidents" element={<AgencyIncidentsPage />} />
          <Route path="incidents/:incidentId" element={<AgencyIncidentDetailPage />} />
          <Route path="messages" element={<AgencyMessagesPage />} />
          <Route path="compliance" element={<AgencyCompliancePage />} />
          <Route path="settings" element={<AgencySettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
