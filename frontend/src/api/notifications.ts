import { apiFetch } from "./client";

export interface NotificationItem {
  id: string;
  type: string;
  summary: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationsResult {
  items: NotificationItem[];
  nextCursor: string | null;
}

export async function listMyNotifications(cursor?: string): Promise<NotificationsResult> {
  return apiFetch("/me/notifications", { query: { cursor } });
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  const res = await apiFetch<{ notification: NotificationItem }>(`/me/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
  return res.notification;
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await apiFetch<{ markedRead: number }>("/me/notifications/read-all", { method: "POST" });
  return res.markedRead;
}
