import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as familyApi from "../api/familyRecipients";
import * as familyCareApi from "../api/familyCare";
import { ApiError } from "../api/client";
import { FamilyHomePage } from "../pages/family/FamilyHomePage";

function renderFamilyHome() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <FamilyHomePage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Family Timeline -- recipients autorizados", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(familyCareApi, "listFamilyShifts").mockResolvedValue([]);
    vi.spyOn(familyCareApi, "listFamilyObservations").mockResolvedValue([]);
    vi.spyOn(familyCareApi, "listFamilyIncidents").mockResolvedValue([]);
  });

  it("muestra la actividad del recipient autorizado", async () => {
    vi.spyOn(familyApi, "listMyCareRecipients").mockResolvedValue([
      { organizationId: "org-1", recipientId: "rec-1", relationshipType: "child", canViewPhotos: true, firstName: "Carmen", lastName: "Rivera", preferredName: null },
    ]);
    vi.spyOn(familyApi, "getFamilyTimeline").mockResolvedValue({
      items: [
        {
          id: "e1",
          type: "MEAL",
          occurredAt: new Date().toISOString(),
          title: "Comida",
          summary: "Almuerzo · Comió casi todo",
          caregiver: { displayName: "María Rivera", role: "CNA" },
        },
      ],
      nextCursor: null,
    });

    renderFamilyHome();

    await waitFor(() => {
      expect(screen.getByText("Almuerzo · Comió casi todo")).toBeInTheDocument();
    });
  });

  it("acceso no autorizado (revocado) se maneja con mensaje claro, no pantalla en blanco", async () => {
    vi.spyOn(familyApi, "listMyCareRecipients").mockResolvedValue([
      { organizationId: "org-1", recipientId: "rec-1", relationshipType: "child", canViewPhotos: true, firstName: "Carmen", lastName: "Rivera", preferredName: null },
    ]);
    vi.spyOn(familyApi, "getFamilyTimeline").mockRejectedValue(new ApiError(404, "RECIPIENT_NOT_FOUND"));

    renderFamilyHome();

    await waitFor(() => {
      expect(screen.getByText(/Ya no tienes acceso/i)).toBeInTheDocument();
    });
  });

  it("estado vacío: sin familiares vinculados", async () => {
    vi.spyOn(familyApi, "listMyCareRecipients").mockResolvedValue([]);

    renderFamilyHome();

    await waitFor(() => {
      expect(screen.getByText("Sin familiares vinculados todavía")).toBeInTheDocument();
    });
  });

  it("muestra el resumen real y curado de cuidado familiar", async () => {
    vi.spyOn(familyApi, "listMyCareRecipients").mockResolvedValue([
      { organizationId: "org-1", recipientId: "rec-1", relationshipType: "child", canViewPhotos: true, firstName: "Carmen", lastName: "Rivera", preferredName: null },
    ]);
    vi.spyOn(familyApi, "getFamilyTimeline").mockResolvedValue({ items: [], nextCursor: null });
    vi.spyOn(familyCareApi, "listFamilyShifts").mockResolvedValue([
      {
        id: "shift-1",
        careRecipientId: "rec-1",
        scheduledStart: "2026-09-06T12:00:00.000Z",
        scheduledEnd: "2026-09-06T21:00:00.000Z",
        status: "in_progress",
        checkedInAt: "2026-09-06T12:03:00.000Z",
        checkedOutAt: null,
      },
    ]);
    vi.spyOn(familyCareApi, "listFamilyObservations").mockResolvedValue([
      { id: "obs-1", careRecipientId: "rec-1", category: "pain", status: "reviewed", createdAt: new Date().toISOString() },
    ]);
    vi.spyOn(familyCareApi, "listFamilyIncidents").mockResolvedValue([
      { id: "inc-1", careRecipientId: "rec-1", severity: "moderate", description: "Caída sin lesión", status: "open", createdAt: new Date().toISOString() },
    ]);

    renderFamilyHome();

    expect(await screen.findByText(/Cuidado en curso desde/i)).toBeInTheDocument();
    expect(screen.getByText(/Dolor ·/i)).toBeInTheDocument();
    expect(screen.getByText("1 incidente activo.")).toBeInTheDocument();
  });
});
