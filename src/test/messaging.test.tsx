import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as authApi from "../api/auth";
import * as messagingApi from "../api/messaging";
import { setToken, ApiError } from "../api/client";
import { MessagesPage } from "../pages/MessagesPage";

function renderMessages() {
  return render(
    <MemoryRouter initialEntries={["/messages"]}>
      <AuthProvider>
        <MessagesPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

const fakeOrg = { id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: ["FAMILY"] };

describe("Messaging", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u1", email: "family@example.com", phone: null },
      organizations: [fakeOrg],
    });
  });

  it("lista conversaciones y abre la primera automáticamente, mostrando sus mensajes", async () => {
    vi.spyOn(messagingApi, "listConversations").mockResolvedValue([
      { id: "conv-1", organization_id: "org-1", care_recipient_id: "rec-1", thread_type: "family_agency", created_at: new Date().toISOString() },
    ]);
    vi.spyOn(messagingApi, "listMessages").mockResolvedValue({
      messages: [
        {
          id: "m1",
          organization_id: "org-1",
          message_thread_id: "conv-1",
          sender_user_id: "other-user",
          body: "Hola, todo bien",
          created_at: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    renderMessages();

    expect(await screen.findByText("Hola, todo bien", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("permite enviar un mensaje nuevo", async () => {
    vi.spyOn(messagingApi, "listConversations").mockResolvedValue([
      { id: "conv-1", organization_id: "org-1", care_recipient_id: "rec-1", thread_type: "family_agency", created_at: new Date().toISOString() },
    ]);
    vi.spyOn(messagingApi, "listMessages").mockResolvedValue({ messages: [], nextCursor: null });
    const sendSpy = vi.spyOn(messagingApi, "sendMessage").mockResolvedValue({
      id: "m2",
      organization_id: "org-1",
      message_thread_id: "conv-1",
      sender_user_id: "u1",
      body: "Gracias por la actualización",
      created_at: new Date().toISOString(),
    });

    renderMessages();

    const input = await screen.findByPlaceholderText("Escribe un mensaje...");
    fireEvent.change(input, { target: { value: "Gracias por la actualización" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith("org-1", "conv-1", "Gracias por la actualización");
      expect(screen.getByText("Gracias por la actualización")).toBeInTheDocument();
    });
  });

  it("muestra error claro cuando el acceso a la conversación fue revocado (404)", async () => {
    vi.spyOn(messagingApi, "listConversations").mockResolvedValue([
      { id: "conv-1", organization_id: "org-1", care_recipient_id: "rec-1", thread_type: "family_agency", created_at: new Date().toISOString() },
    ]);
    vi.spyOn(messagingApi, "listMessages").mockRejectedValue(new ApiError(404, "NOT_FOUND"));

    renderMessages();

    await waitFor(() => {
      expect(screen.getByText(/ya no está disponible para ti/i)).toBeInTheDocument();
    });
  });

  it("estado vacío: sin conversaciones", async () => {
    vi.spyOn(messagingApi, "listConversations").mockResolvedValue([]);

    renderMessages();

    await waitFor(() => {
      expect(screen.getByText("Sin conversaciones todavía")).toBeInTheDocument();
    });
  });
});
