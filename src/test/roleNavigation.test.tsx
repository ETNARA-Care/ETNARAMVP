import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { TopNav } from "../navigation/TopNav";
import * as authApi from "../api/auth";
import { setToken } from "../api/client";

function renderNav() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TopNav />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Auth -- usuario autenticado", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token-for-test");
  });

  it("Admin ve navegación administrativa (Panel)", async () => {
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u1", email: "admin@example.com", phone: null },
      organizations: [
        { id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: ["ORGANIZATION_ADMIN"] },
      ],
    });

    renderNav();

    await waitFor(() => {
      expect(screen.getByText("Panel")).toBeInTheDocument();
    });
    expect(screen.queryByText("Inicio")).not.toBeInTheDocument();
  });

  it("Caregiver (sin rol FAMILY ni admin) no ve controles administrativos", async () => {
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "caregiver@example.com", phone: null },
      organizations: [{ id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: [] }],
    });

    renderNav();

    await waitFor(() => {
      expect(screen.getByText("Mensajes")).toBeInTheDocument();
    });
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Inicio")).not.toBeInTheDocument();
  });

  it("Caregiver ve un enlace real a su espacio de trabajo ('Mis turnos')", async () => {
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "caregiver@example.com", phone: null },
      organizations: [{ id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: [] }],
    });

    renderNav();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Mis turnos" })).toHaveAttribute("href", "/caregiver");
    });
  });

  it("Family no ve el enlace administrativo 'Panel'", async () => {
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u3", email: "family@example.com", phone: null },
      organizations: [{ id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: ["FAMILY"] }],
    });

    renderNav();

    await waitFor(() => {
      expect(screen.getByText("Inicio")).toBeInTheDocument();
    });
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
  });
});
