import { apiClient } from "./client";

export interface NotificationItem {
  id: string;
  type: string;
  summary: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  careRecipientId: string | null;
  shiftId: string | null;
  workerMembershipId: string | null;
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
  if (type === "OPEN_SHIFT_OFFER") return "Nuevo turno disponible";
  if (type === "OPEN_SHIFT_INTERESTED") return "Una cuidadora está disponible para un turno";
  if (type === "OPEN_SHIFT_DECLINED") return "Respuesta a una oferta de turno";
  if (type === "SMARTMATCH_APPLICATION_SUBMITTED") return "Nueva solicitud en SmartMatch";
  if (type === "SMARTMATCH_APPLICATION_APPROVED") return "Tu solicitud fue aprobada";
  if (type === "SMARTMATCH_APPLICATION_REJECTED") return "Tu solicitud no fue aprobada";
  if (type === "SMARTMATCH_APPLICATION_CLOSED") return "La oportunidad se cubrió con otra persona";
  if (type === "SMARTMATCH_OPPORTUNITY_CANCELLED") return "La agencia canceló una oportunidad que tenías aprobada";
  if (type === "SHIFT_LATE_ARRIVAL") return "Turno sin llegada registrada (15 min)";
  if (type === "SHIFT_ARRIVAL_NEEDS_REVIEW") return "Llegada pendiente de revisión";
  if (type === "SHIFT_LOCATION_CHANGED") return "Cambió la dirección de uno de tus turnos";
  if (type === "LOCATION_CHANGE_REQUESTED") return "Un familiar solicitó corregir una dirección";
  if (type === "LOCATION_CHANGE_APPROVED") return "La agencia aplicó tu corrección de dirección";
  if (type === "LOCATION_CHANGE_REJECTED") return "La agencia revisó tu corrección de dirección";
  // Gate 7 «En camino»: never an address, a location or an estimated time.
  if (type === "FAMILY_CAREGIVER_EN_ROUTE") return "La cuidadora va en camino";
  if (type === "FAMILY_CAREGIVER_DELAYED") return "La cuidadora informó un retraso";
  if (type === "FAMILY_CAREGIVER_ARRIVED") return "La cuidadora llegó al domicilio";
  if (type === "SHIFT_NOT_EN_ROUTE") return "Aún no registra salida (turno en 30 min)";
  if (type === "SHIFT_DELAY_REPORTED") return "Retraso de 30 min o más informado";
  if (type === "SHIFT_STARTED") return "La cuidadora comenzó el turno";
  if (type === "SHIFT_COMPLETED") return "La cuidadora finalizó el turno";
  if (type === "CREDENTIAL_EXPIRING") return "Credencial próxima a vencer";
  if (type === "CREDENTIAL_EXPIRED") return "Credencial vencida";
  if (type === "CREDENTIAL_REVIEW_PENDING") return "Credencial pendiente de revisión";
  if (type === "CREDENTIAL_REVIEW_APPROVED") return "Credencial aprobada";
  if (type === "CREDENTIAL_REVIEW_REJECTED") return "Credencial rechazada";
  if (type === "OPERATIONAL_ALERT_ESCALATED") return "Alerta operacional escalada";
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
    workerMembershipId: null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function markAllNotificationsRead(token: string): Promise<number> {
  const result = await apiClient.post<{ markedRead: number }>("/me/notifications/read-all", {}, token);
  return result.markedRead;
}
