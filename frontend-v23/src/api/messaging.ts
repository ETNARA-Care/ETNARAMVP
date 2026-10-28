import { apiClient } from "./client";

export interface Conversation {
  id: string;
  organization_id: string;
  care_recipient_id: string | null;
  thread_type: string;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  organization_id: string;
  message_thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

export async function listConversations(organizationId: string, token: string): Promise<Conversation[]> {
  const result = await apiClient.get<{ conversations: Conversation[] }>(
    `/organizations/${organizationId}/conversations`,
    token,
  );
  return result.conversations;
}

export function listMessages(
  organizationId: string,
  conversationId: string,
  token: string,
): Promise<{ messages: ConversationMessage[]; nextCursor: string | null }> {
  return apiClient.get(
    `/organizations/${organizationId}/conversations/${conversationId}/messages`,
    token,
  );
}

export async function sendMessage(
  organizationId: string,
  conversationId: string,
  body: string,
  token: string,
): Promise<ConversationMessage> {
  const result = await apiClient.post<{ message: ConversationMessage }>(
    `/organizations/${organizationId}/conversations/${conversationId}/messages`,
    { body },
    token,
  );
  return result.message;
}

/**
 * Abre la conversación de un residente (familia + equipo) o la crea si aún no
 * existe. El backend valida que quien la pide tenga acceso a ese residente.
 */
export async function openRecipientConversation(organizationId: string, recipientId: string, token: string): Promise<Conversation> {
  const result = await apiClient.post<{ conversation: Conversation }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}/conversation`,
    undefined,
    token,
  );
  return result.conversation;
}

/** Conversación directa agencia ↔ cuidadora (sin residente). Backend #238 / migración 136. */
export interface CaregiverConversation {
  conversationId: string;
  organizationWorkerMembershipId: string;
  caregiverName: string;
  organizationName: string;
}

/**
 * Abre (o devuelve) la conversación directa con una cuidadora. Solo la
 * administradora de la agencia; el backend nunca duplica la conversación.
 */
export function openCaregiverConversation(
  organizationId: string,
  workerMembershipId: string,
  token: string,
): Promise<{ conversationId: string; created: boolean }> {
  return apiClient.post(`/organizations/${organizationId}/workers/${workerMembershipId}/conversation`, undefined, token);
}

/** Conversaciones directas visibles para quien pregunta, con el nombre que se muestra. */
export async function listCaregiverConversations(organizationId: string, token: string): Promise<CaregiverConversation[]> {
  const result = await apiClient.get<{ conversations: CaregiverConversation[] }>(
    `/organizations/${organizationId}/caregiver-conversations`,
    token,
  );
  return result.conversations;
}
