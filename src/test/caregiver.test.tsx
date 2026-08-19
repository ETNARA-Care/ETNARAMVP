import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as authApi from "../api/auth";
import * as agencyApi from "../api/agency";
import * as verificationApi from "../api/verification";
import { setToken, ApiError } from "../api/client";
import { CaregiverShiftsPage } from "../pages/caregiver/CaregiverShiftsPage";

const fakeOrg = { id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: [] };

function renderShifts() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <CaregiverShiftsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Caregiver -- mis turnos", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "maria@example.com", phone: null },
      organizations: [fakeOrg],
    });
  });

  it("pide turnos desde hoy para no arrastrar turnos viejos", async () => {
    const listSpy = vi.spyOn(agencyApi, "listOrgShifts").mockResolvedValue([]);
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

    renderShifts();

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith("org-1", { dateFrom: today });
    });
  });

  it("muestra el turno asignado y el botón para iniciar visita", async () => {
    vi.spyOn(agencyApi, "listOrgShifts").mockResolvedValue([
      {
        id: "shift-1",
        organization_id: "org-1",
        care_recipient_id: "rec-1",
        room_id: null,
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: "confirmed",
      },
    ]);
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "not_started" });

    renderShifts();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Iniciar visita" })).toBeInTheDocument();
    });
  });

  it("iniciar visita llama a la API real de check-in y actualiza el botón a 'Finalizar visita'", async () => {
    vi.spyOn(agencyApi, "listOrgShifts").mockResolvedValue([
      {
        id: "shift-1",
        organization_id: "org-1",
        care_recipient_id: "rec-1",
        room_id: null,
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: "confirmed",
      },
    ]);
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "not_started" });
    const checkInSpy = vi
      .spyOn(verificationApi, "checkIn")
      .mockResolvedValue({ id: "ev1", event_type: "check_in", occurred_at: new Date().toISOString() });

    renderShifts();

    const button = await screen.findByRole("button", { name: "Iniciar visita" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(checkInSpy).toHaveBeenCalledWith("org-1", "shift-1");
      expect(screen.getByRole("button", { name: "Finalizar visita" })).toBeInTheDocument();
    });
  });

  it("muestra mensaje claro si el check-in falla por elegibilidad (409)", async () => {
    vi.spyOn(agencyApi, "listOrgShifts").mockResolvedValue([
      {
        id: "shift-1",
        organization_id: "org-1",
        care_recipient_id: "rec-1",
        room_id: null,
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: "confirmed",
      },
    ]);
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "not_started" });
    vi.spyOn(verificationApi, "checkIn").mockRejectedValue(new ApiError(409, "WORKER_NOT_ELIGIBLE_EXPIRED"));

    renderShifts();

    const button = await screen.findByRole("button", { name: "Iniciar visita" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/No cumples los requisitos vigentes/i)).toBeInTheDocument();
    });
  });

  it("estado vacío: sin turnos asignados", async () => {
    vi.spyOn(agencyApi, "listOrgShifts").mockResolvedValue([]);

    renderShifts();

    await waitFor(() => {
      expect(screen.getByText("Sin turnos asignados")).toBeInTheDocument();
    });
  });
});
