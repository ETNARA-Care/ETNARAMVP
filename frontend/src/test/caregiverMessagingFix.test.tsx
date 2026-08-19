import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import * as authApi from "../api/auth";
import * as messagingApi from "../api/messaging";
import { setToken } from "../api/client";
import { MessagesPage } from "../pages/MessagesPage";

// Reproduce exacto del bug reportado: Family envía un mensaje, pero María
// (Caregiver, sin rol FAMILY) entraba a Mensajes sin recipientId en la URL
// y por lo tanto nunca se unía como participante del hilo real -- veía
// "Sin conversaciones todavía" aunque el hilo ya existiera. El fix es de
// frontend únicamente: el workspace del Caregiver ahora enlaza a Mensajes
// con el recipientId real de su turno asignado, así que este mismo flujo
// de MessagesPage (ya usado por Family) también une al Caregiver como
// participante real del hilo `family_agency` -- sin ningún cambio de
// backend ni de reglas de autorización.
const caregiverOrg = { id: "org-1", name: "Agencia Demo", type: "HOME_CARE_AGENCY", membershipStatus: "active", roles: [] };

function renderMessagesForCaregiver(recipientId: string) {
  return render(
    <MemoryRouter initialEntries={[`/messages?recipientId=${recipientId}`]}>
      <AuthProvider>
        <MessagesPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Fix Family -> Caregiver messaging (uso real de recipientId del turno)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setToken("fake-token");
    vi.spyOn(authApi, "getMe").mockResolvedValue({
      user: { id: "u2", email: "maria@example.com", phone: null },
      organizations: [caregiverOrg],
    });
  });

  it("el Caregiver se une como participante real del hilo al llegar con el recipientId de su turno asignado", async () => {
    const openSpy = vi.spyOn(messagingApi, "openRecipientConversation").mockResolvedValue({
      id: "conv-1",
      organization_id: "org-1",
      care_recipient_id: "rec-1",
      thread_type: "family_agency",
      created_at: new Date().toISOString(),
    });
    vi.spyOn(messagingApi, "listConversations").mockResolvedValue([
      { id: "conv-1", organization_id: "org-1", care_recipient_id: "rec-1", thread_type: "family_agency", created_at: new Date().toISOString() },
    ]);
    vi.spyOn(messagingApi, "listMessages").mockResolvedValue({
      messages: [
        {
          id: "m1",
          organization_id: "org-1",
          message_thread_id: "conv-1",
          sender_user_id: "family-user",
          body: "¡Hola! Doña Carmen tuvo una tarde tranquila.",
          created_at: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });

    renderMessagesForCaregiver("rec-1");

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("org-1", "rec-1");
    });
    await waitFor(() => {
      expect(screen.getByText("¡Hola! Doña Carmen tuvo una tarde tranquila.")).toBeInTheDocument();
    });
  });
});
