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
