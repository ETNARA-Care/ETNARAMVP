import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import * as notificationsApi from "../api/notifications";
import { NotificationsPage } from "../pages/NotificationsPage";

describe("Notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lista notificaciones", async () => {
    vi.spyOn(notificationsApi, "listMyNotifications").mockResolvedValue({
      items: [
        {
          id: "n1",
          type: "NEW_MESSAGE",
          summary: "Nuevo mensaje",
          relatedEntityType: "message_thread",
          relatedEntityId: "conv-1",
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      nextCursor: null,
    });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Nuevo mensaje")).toBeInTheDocument();
    });
  });

  it("marcar como leída llama a la API real y actualiza el estado visual", async () => {
    vi.spyOn(notificationsApi, "listMyNotifications").mockResolvedValue({
      items: [
        {
          id: "n1",
          type: "NEW_MESSAGE",
          summary: "Nuevo mensaje",
          relatedEntityType: null,
          relatedEntityId: null,
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      nextCursor: null,
    });
    const markSpy = vi.spyOn(notificationsApi, "markNotificationRead").mockResolvedValue({
      id: "n1",
      type: "NEW_MESSAGE",
      summary: "Nuevo mensaje",
      relatedEntityType: null,
      relatedEntityId: null,
      createdAt: new Date().toISOString(),
      readAt: new Date().toISOString(),
    });

    render(<NotificationsPage />);

    const button = await screen.findByRole("button", { name: "Marcar como leída" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(markSpy).toHaveBeenCalledWith("n1");
    });
  });

  it("estado vacío: sin notificaciones", async () => {
    vi.spyOn(notificationsApi, "listMyNotifications").mockResolvedValue({ items: [], nextCursor: null });

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Sin notificaciones")).toBeInTheDocument();
    });
  });

  it("estado de error cuando la API falla", async () => {
    vi.spyOn(notificationsApi, "listMyNotifications").mockRejectedValue(new Error("network"));

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText("No pudimos cargar tus notificaciones.")).toBeInTheDocument();
    });
  });
});
