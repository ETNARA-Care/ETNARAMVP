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
 * Residentes sobre los que quien llama puede iniciar una conversación
 * (Backend #234): toda la agencia para la administración, su familiar para la
 * familia y, para la cuidadora, solo las personas de sus turnos aceptados hasta
 * 24 h después de terminar.
 */
export async function listStartableRecipients(organizationId: string, token: string): Promise<Array<{ id: string; name: string }>> {
  const result = await apiClient.get<{ recipients: Array<{ id: string; firstName: string; lastName: string; preferredName: string | null }> }>(
    `/organizations/${organizationId}/conversations/startable-recipients`,
    token,
  );
  return result.recipients.map((r) => ({ id: r.id, name: r.preferredName || `${r.firstName} ${r.lastName}`.trim() }));
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
