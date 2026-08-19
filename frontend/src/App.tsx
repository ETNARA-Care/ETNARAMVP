import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { RequireAuth, roleHome } from "./auth/RequireAuth";
import { TopNav } from "./navigation/TopNav";
import { LoginPage } from "./pages/auth/LoginPage";
import { FamilyHomePage } from "./pages/family/FamilyHomePage";
import { AgencyDashboardRealPage } from "./pages/agency/AgencyDashboardRealPage";
import { AgencyShiftsPage } from "./pages/agency/AgencyShiftsPage";
import { AgencyRecipientsPage } from "./pages/agency/AgencyRecipientsPage";
import { AgencyTeamPage } from "./pages/agency/AgencyTeamPage";
import { AgencyResidentProfilePage } from "./pages/agency/AgencyResidentProfilePage";
import { CaregiverShiftsPage } from "./pages/caregiver/CaregiverShiftsPage";
import { CaregiverShiftWorkspacePage } from "./pages/caregiver/CaregiverShiftWorkspacePage";
import { CaregiverCareEventFormPage } from "./pages/caregiver/CaregiverCareEventFormPage";
import { CaregiverObservationFormPage } from "./pages/caregiver/CaregiverObservationFormPage";
import { CaregiverIncidentFormPage } from "./pages/caregiver/CaregiverIncidentFormPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotificationsPage } from "./pages/NotificationsPage";

function AppShell() {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)" }}>
      <TopNav />
      <Outlet />
    </div>
  );
}

function RoleHomeRedirect() {
  const { activeOrganization } = useAuth();
  return <Navigate to={roleHome(activeOrganization?.roles ?? [])} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<RoleHomeRedirect />} />
              <Route path="/family" element={<FamilyHomePage />} />
              <Route path="/agency" element={<AgencyDashboardRealPage />} />
              <Route path="/agency/turnos" element={<AgencyShiftsPage />} />
              <Route path="/agency/personas" element={<AgencyRecipientsPage />} />
              <Route path="/agency/personas/:residentId" element={<AgencyResidentProfilePage />} />
              <Route path="/agency/equipo" element={<AgencyTeamPage />} />
              <Route path="/caregiver" element={<CaregiverShiftsPage />} />
              <Route path="/caregiver/shifts/:shiftId" element={<CaregiverShiftWorkspacePage />} />
              <Route path="/caregiver/shifts/:shiftId/care-events/:typeCode" element={<CaregiverCareEventFormPage />} />
              <Route path="/caregiver/shifts/:shiftId/observations/new" element={<CaregiverObservationFormPage />} />
              <Route path="/caregiver/shifts/:shiftId/incidents/new" element={<CaregiverIncidentFormPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
