import { apiClient } from "./client";

export interface NotificationItem {
  id: string;
  type: string;
  summary: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  careRecipientId: string | null;
  shiftId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

interface NotificationMutationRow {
  id: string;
  notification_type: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  read_at: string | null;
}

function notificationSummary(type: string): string {
  if (type === "NEW_MESSAGE") return "Nuevo mensaje";
  if (type === "NEW_CARE_EVENT") return "Nueva actividad de cuidado";
  if (type === "NEW_INCIDENT") return "Nuevo incidente";
  if (type === "SHIFT_ASSIGNMENT_PENDING") return "Nuevo turno pendiente de respuesta";
  if (type === "SHIFT_ASSIGNMENT_ACCEPTED") return "Turno aceptado por la cuidadora";
  if (type === "SHIFT_ASSIGNMENT_REJECTED") return "Turno rechazado por la cuidadora";
  return "Notificación";
}

export function listMyNotifications(token: string): Promise<NotificationPage> {
  return apiClient.get<NotificationPage>("/me/notifications", token);
}

export async function markNotificationRead(notificationId: string, token: string): Promise<NotificationItem> {
  const result = await apiClient.patch<{ notification: NotificationMutationRow }>(
    `/me/notifications/${notificationId}/read`,
    {},
    token,
  );
  const row = result.notification;
  return {
    id: row.id,
    type: row.notification_type,
    summary: notificationSummary(row.notification_type),
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    careRecipientId: null,
    shiftId: null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const result = await apiClient.post<{ markedRead: number }>("/me/notifications/read-all", {}, token);
  return result.markedRead;
}
