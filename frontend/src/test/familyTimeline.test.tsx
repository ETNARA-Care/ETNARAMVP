import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as familyApi from "../api/familyRecipients";
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
});
