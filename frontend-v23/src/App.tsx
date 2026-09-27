import { Routes, Route, Navigate } from "react-router-dom";
import { DemoLandingPage } from "@/pages/DemoLandingPage";
import { RootRedirect } from "@/pages/RootRedirect";
import { LoginPage } from "@/pages/LoginPage";
import { ActivateInvitationPage } from "@/pages/ActivateInvitationPage";
import { SelectOrganizationPage } from "@/pages/SelectOrganizationPage";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { RoleGuard } from "@/auth/RoleGuard";
import { PlatformGuard } from "@/auth/PlatformGuard";
import { PlatformLayout } from "@/layouts/PlatformLayout";
import { PlatformCredentialVerificationPage } from "@/pages/platform/PlatformCredentialVerificationPage";
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
import {
  CaregiverMessagesPage,
  CaregiverProfilePage,
} from "@/pages/caregiver/CaregiverSupportPages";
import { EstablishmentAdminPage } from "@/pages/caregiver/EstablishmentAdminPage";
import { AgencyLayout } from "@/layouts/AgencyLayout";
import { AgencyOverviewPage } from "@/pages/agency/AgencyOverviewPage";
import { AgencyShiftsPage } from "@/pages/agency/AgencyShiftsPage";
import { AgencyShiftDetailPage } from "@/pages/agency/AgencyShiftDetailPage";
import { AgencyWorkforcePlanningPage } from "@/pages/agency/AgencyWorkforcePlanningPage";
import { AgencyTimesheetsPage } from "@/pages/agency/AgencyTimesheetsPage";
import { AgencyOperationsPage } from "@/pages/agency/AgencyOperationsPage";
import { AgencyAgentCenterPage } from "@/pages/agency/AgencyAgentCenterPage";
import { AgencyCareQualityPage } from "@/pages/agency/AgencyCareQualityPage";
import { AgencyWorkerProfilePage } from "@/pages/agency/AgencyWorkerProfilePage";
import { AgencyIncidentsPage } from "@/pages/agency/AgencyIncidentsPage";
import { AgencyIncidentDetailPage } from "@/pages/agency/AgencyIncidentDetailPage";
import { AgencyResidentProfilePage } from "@/pages/agency/AgencyResidentProfilePage";
import { AgencyEstablishmentPage } from "@/pages/agency/AgencyEstablishmentPage";
import { AgencyOrganizationSettingsPage } from "@/pages/agency/AgencyOrganizationSettingsPage";
import { FamilyIncidentDetailPage } from "@/pages/family/FamilyIncidentDetailPage";
import {
  AgencyResidentsPage,
  AgencyWorkersPage,
  AgencyMessagesPage,
  AgencyCompliancePage,
} from "@/pages/agency/AgencySupportPages";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/demo" element={<DemoLandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivateInvitationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/select-organization" element={<SelectOrganizationPage />} />

        <Route
          path="/platform"
          element={
            <PlatformGuard>
              <PlatformLayout />
            </PlatformGuard>
          }
        >
          <Route index element={<PlatformCredentialVerificationPage />} />
        </Route>

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
          <Route
            path="admin/establishments/:establishmentId"
            element={<EstablishmentAdminPage />}
          />
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
          <Route path="planning" element={<AgencyWorkforcePlanningPage />} />
          <Route path="timesheets" element={<AgencyTimesheetsPage />} />
          <Route path="operations" element={<AgencyOperationsPage />} />
          <Route path="agents" element={<AgencyAgentCenterPage />} />
          <Route path="quality" element={<AgencyCareQualityPage />} />
          <Route path="incidents" element={<AgencyIncidentsPage />} />
          <Route path="incidents/:incidentId" element={<AgencyIncidentDetailPage />} />
          <Route path="messages" element={<AgencyMessagesPage />} />
          <Route path="compliance" element={<AgencyCompliancePage />} />
          <Route path="settings" element={<AgencyOrganizationSettingsPage />} />
          <Route
            path="settings/establishments/:establishmentId"
            element={<AgencyEstablishmentPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
