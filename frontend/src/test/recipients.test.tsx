import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as authApi from "../api/auth";
import * as agencyApi from "../api/agency";
import * as notificationsApi from "../api/notifications";
import * as incidentsApi from "../api/incidents";
import { setToken, ApiError } from "../api/client";
import { AgencyDashboardRealPage } from "../pages/agency/AgencyDashboardRealPage";

const fakeOrg = { id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: ["ORGANIZATION_ADMIN"] };

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AgencyDashboardRealPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Recipients -- panel de agencia", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u1", email: "admin@example.com", phone: null },
      organizations: [fakeOrg],
    });
    vi.spyOn(notificationsApi, "listMyNotifications").mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(agencyApi, "listOrgShifts").mockResolvedValue([]);
    vi.spyOn(incidentsApi, "listIncidents").mockResolvedValue([]);
  });

  it("lista recipients autorizados de la organización activa", async () => {
    vi.spyOn(agencyApi, "listOrgCareRecipients").mockResolvedValue([
      {
        id: "rec-1",
        organization_id: "org-1",
        first_name: "Carmen",
        last_name: "Rivera",
        preferred_name: "Doña Carmen",
        date_of_birth: null,
        status: "active",
        room_id: null,
        created_at: new Date().toISOString(),
      },
    ]);
    vi.spyOn(agencyApi, "getShiftCoverage").mockResolvedValue({ total: 4, covered: 3, uncovered: 1, cancelled: 0 });
    vi.spyOn(agencyApi, "listOrgWorkers").mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Doña Carmen Rivera/)).toBeInTheDocument();
    });
    expect(screen.getByText("3/4")).toBeInTheDocument();
  });

  it("acceso no autorizado (403) se maneja con estado de error, no pantalla en blanco", async () => {
    vi.spyOn(agencyApi, "listOrgCareRecipients").mockRejectedValue(new ApiError(403, "ORGANIZATION_ACCESS_DENIED"));
    vi.spyOn(agencyApi, "getShiftCoverage").mockResolvedValue({ total: 0, covered: 0, uncovered: 0, cancelled: 0 });
    vi.spyOn(agencyApi, "listOrgWorkers").mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No pudimos cargar la información del panel.")).toBeInTheDocument();
    });
  });

  it("estado vacío: sin recipients todavía", async () => {
    vi.spyOn(agencyApi, "listOrgCareRecipients").mockResolvedValue([]);
    vi.spyOn(agencyApi, "getShiftCoverage").mockResolvedValue({ total: 0, covered: 0, uncovered: 0, cancelled: 0 });
    vi.spyOn(agencyApi, "listOrgWorkers").mockResolvedValue([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Todavía no hay personas registradas.")).toBeInTheDocument();
    });
  });
});
