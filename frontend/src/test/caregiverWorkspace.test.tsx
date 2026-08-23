import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as authApi from "../api/auth";
import * as agencyApi from "../api/agency";
import * as verificationApi from "../api/verification";
import * as careEventsApi from "../api/careEvents";
import * as observationsApi from "../api/observations";
import * as incidentsApi from "../api/incidents";
import { setToken } from "../api/client";
import { CaregiverShiftWorkspacePage } from "../pages/caregiver/CaregiverShiftWorkspacePage";
import { CaregiverCareEventFormPage } from "../pages/caregiver/CaregiverCareEventFormPage";
import { CaregiverObservationFormPage } from "../pages/caregiver/CaregiverObservationFormPage";
import { CaregiverIncidentFormPage } from "../pages/caregiver/CaregiverIncidentFormPage";

const fakeOrg = { id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: [] };

const fakeShift = {
  id: "shift-1",
  organization_id: "org-1",
  care_recipient_id: "rec-1",
  room_id: null,
  scheduled_start: new Date().toISOString(),
  scheduled_end: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
  status: "confirmed",
};

const fakeRecipient = {
  id: "rec-1",
  organization_id: "org-1",
  first_name: "Carmen",
  last_name: "Rivera",
  preferred_name: "Doña Carmen",
  date_of_birth: null,
  status: "active",
  room_id: null,
  created_at: new Date().toISOString(),
};

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/caregiver/shifts/:shiftId" element={<CaregiverShiftWorkspacePage />} />
          <Route path="/caregiver/shifts/:shiftId/care-events/:typeCode" element={<CaregiverCareEventFormPage />} />
          <Route path="/caregiver/shifts/:shiftId/observations/new" element={<CaregiverObservationFormPage />} />
          <Route path="/caregiver/shifts/:shiftId/incidents/new" element={<CaregiverIncidentFormPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Caregiver -- espacio de trabajo del turno", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "maria@example.com", phone: null },
      organizations: [fakeOrg],
    });
    vi.spyOn(agencyApi, "getOrgShift").mockResolvedValue(fakeShift);
    vi.spyOn(agencyApi, "listOrgCareRecipients").mockResolvedValue([fakeRecipient]);
    vi.spyOn(observationsApi, "listObservations").mockResolvedValue([]);
    vi.spyOn(incidentsApi, "listIncidents").mockResolvedValue([]);
    vi.spyOn(careEventsApi, "listShiftCareEvents").mockResolvedValue([]);
  });

  it("muestra a la persona bajo cuidado real del turno y deshabilita el registro de cuidados sin visita activa", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "not_started" });

    renderAt("/caregiver/shifts/shift-1");

    await waitFor(() => {
      expect(screen.getByText("Doña Carmen Rivera")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Iniciar visita" })).toBeInTheDocument();
    expect(
      screen.getByText("Inicia la visita para poder registrar comida, hidratación y otros cuidados de este turno.")
    ).toBeInTheDocument();
  });

  it("expone acceso a Mensajes con la familia usando el recipientId real del turno", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "in_progress" });

    renderAt("/caregiver/shifts/shift-1");

    await waitFor(() => {
      expect(screen.getByText("Doña Carmen Rivera")).toBeInTheDocument();
    });
    const messageLink = screen.getByRole("link", { name: "Enviar mensaje a la familia" });
    expect(messageLink.getAttribute("href")).toBe("/messages?recipientId=rec-1");
  });

  it("con visita activa, permite navegar a registrar un Care Event real", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "in_progress" });

    renderAt("/caregiver/shifts/shift-1");

    await waitFor(() => {
      expect(screen.getByText("Doña Carmen Rivera")).toBeInTheDocument();
    });
    const mealLink = screen.getByRole("link", { name: "Comida" });
    expect(mealLink.getAttribute("href")).toBe("/caregiver/shifts/shift-1/care-events/MEAL?recipientId=rec-1");
  });

  it("PHOTO se muestra como Próximamente, sin ningún control de subida", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "in_progress" });

    renderAt("/caregiver/shifts/shift-1");

    await waitFor(() => {
      expect(screen.getByText("Doña Carmen Rivera")).toBeInTheDocument();
    });
    expect(screen.getByText("Próximamente")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Foto" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/subir foto/i)).not.toBeInTheDocument();
  });

  it("muestra el rango horario del turno programado", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "not_started" });

    renderAt("/caregiver/shifts/shift-1");

    await waitFor(() => {
      expect(screen.getByText("Doña Carmen Rivera")).toBeInTheDocument();
    });
    const start = new Date(fakeShift.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const end = new Date(fakeShift.scheduled_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    expect(screen.getByText(`${start} → ${end}`)).toBeInTheDocument();
  });

  it("pide confirmación antes de finalizar la visita y no llama a check-out si se cancela", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "in_progress" });
    const checkOutSpy = vi.spyOn(verificationApi, "checkOut");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderAt("/caregiver/shifts/shift-1");

    const button = await screen.findByRole("button", { name: "Finalizar visita" });
    fireEvent.click(button);

    expect(confirmSpy).toHaveBeenCalledWith("¿Confirmas que quieres finalizar la visita?");
    expect(checkOutSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("al confirmar, finaliza la visita y muestra el resumen de cuidados registrados", async () => {
    vi.spyOn(verificationApi, "getVisitVerification").mockResolvedValue({ shiftId: "shift-1", events: [], status: "in_progress" });
    vi.spyOn(careEventsApi, "listShiftCareEvents").mockResolvedValue([
      {
        id: "ce-1",
        organization_id: "org-1",
        shift_id: "shift-1",
        care_recipient_id: "rec-1",
        organization_worker_membership_id: "m1",
        care_event_type_id: "t1",
        type_code: "MEAL",
        occurred_at: new Date().toISOString(),
        note_text: null,
        structured_data: { mealType: "Almuerzo", amountConsumed: "Todo" },
        created_at: new Date().toISOString(),
      },
    ]);
    vi.spyOn(verificationApi, "checkOut").mockResolvedValue({ id: "ev2", event_type: "check_out", occurred_at: new Date().toISOString() });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderAt("/caregiver/shifts/shift-1");

    const button = await screen.findByRole("button", { name: "Finalizar visita" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Visita completada · 1 cuidado registrado/)).toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });
});

describe("Caregiver -- registrar Care Event real (MEAL)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "maria@example.com", phone: null },
      organizations: [fakeOrg],
    });
  });

  it("envía typeCode, careRecipientId y payload real al backend", async () => {
    const createSpy = vi.spyOn(careEventsApi, "createCareEvent").mockResolvedValue({
      id: "ce-1",
      organization_id: "org-1",
      shift_id: "shift-1",
      care_recipient_id: "rec-1",
      organization_worker_membership_id: "m1",
      care_event_type_id: "t1",
      occurred_at: new Date().toISOString(),
      note_text: null,
      structured_data: { mealType: "Almuerzo", amountConsumed: "Casi todo" },
      created_at: new Date().toISOString(),
    });

    renderAt("/caregiver/shifts/shift-1/care-events/MEAL?recipientId=rec-1");

    fireEvent.click(await screen.findByRole("button", { name: "Almuerzo" }));
    fireEvent.click(screen.getByRole("button", { name: "Casi todo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("org-1", "shift-1", {
        typeCode: "MEAL",
        careRecipientId: "rec-1",
        payload: { mealType: "Almuerzo", amountConsumed: "Casi todo" },
        noteText: undefined,
      });
    });
  });

  it("muestra copy humano cuando el backend responde 409 NO_ACTIVE_VISIT", async () => {
    const { ApiError } = await import("../api/client");
    vi.spyOn(careEventsApi, "createCareEvent").mockRejectedValue(new ApiError(409, "NO_ACTIVE_VISIT"));

    renderAt("/caregiver/shifts/shift-1/care-events/MEAL?recipientId=rec-1");

    fireEvent.click(await screen.findByRole("button", { name: "Desayuno" }));
    fireEvent.click(screen.getByRole("button", { name: "Todo" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));

    await waitFor(() => {
      expect(screen.getByText("Debes iniciar la visita antes de registrar este cuidado.")).toBeInTheDocument();
    });
  });
});

describe("Caregiver -- Observación real", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "maria@example.com", phone: null },
      organizations: [fakeOrg],
    });
  });

  it("envía la categoría real del enum del backend", async () => {
    const createSpy = vi.spyOn(observationsApi, "createObservation").mockResolvedValue({
      id: "obs-1",
      organization_id: "org-1",
      care_recipient_id: "rec-1",
      organization_worker_membership_id: "m1",
      care_event_id: null,
      category: "low_appetite",
      description: "Comió muy poco en el almuerzo",
      status: "open",
      created_at: new Date().toISOString(),
    });

    renderAt("/caregiver/shifts/shift-1/observations/new?recipientId=rec-1");

    fireEvent.click(await screen.findByRole("button", { name: "Poco apetito" }));
    fireEvent.change(screen.getByLabelText("Descripción (opcional)"), {
      target: { value: "Comió muy poco en el almuerzo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar observación" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("org-1", {
        careRecipientId: "rec-1",
        category: "low_appetite",
        description: "Comió muy poco en el almuerzo",
      });
    });
  });
});

describe("Caregiver -- Incidente real, sin controles de manager", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "maria@example.com", phone: null },
      organizations: [fakeOrg],
    });
  });

  it("permite crear un incidente directamente, sin mostrar cambiar estado ni asignar", async () => {
    const createSpy = vi.spyOn(incidentsApi, "createIncident").mockResolvedValue({
      id: "inc-1",
      organization_id: "org-1",
      care_recipient_id: "rec-1",
      organization_worker_membership_id: "m1",
      escalated_from_observation_id: null,
      severity: "Moderado",
      description: "Se cayó al levantarse de la silla",
      actions_taken: null,
      assigned_to_user_id: null,
      resolution: null,
      status: "open",
      created_at: new Date().toISOString(),
    });

    renderAt("/caregiver/shifts/shift-1/incidents/new?recipientId=rec-1");

    fireEvent.click(await screen.findByRole("button", { name: "Moderado" }));
    fireEvent.change(screen.getByLabelText("Descripción de lo ocurrido"), {
      target: { value: "Se cayó al levantarse de la silla" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reportar incidente" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("org-1", {
        careRecipientId: "rec-1",
        severity: "Moderado",
        description: "Se cayó al levantarse de la silla",
        actionsTaken: undefined,
      });
    });

    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /asignar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resolver/i })).not.toBeInTheDocument();
  });
});
