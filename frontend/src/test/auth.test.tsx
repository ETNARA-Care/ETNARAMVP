import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { RequireAuth } from "../auth/RequireAuth";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    getToken: vi.fn(() => null),
  };
});

function ProtectedProbe() {
  return <div>contenido protegido</div>;
}

describe("Auth -- usuario no autenticado", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("redirige a /login cuando no hay sesión", async () => {
    render(
      <MemoryRouter initialEntries={["/agency"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>pantalla de login</div>} />
            <Route element={<RequireAuth />}>
              <Route path="/agency" element={<ProtectedProbe />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("pantalla de login")).toBeInTheDocument();
    });
    expect(screen.queryByText("contenido protegido")).not.toBeInTheDocument();
  });
});
