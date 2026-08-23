import { apiFetch } from "./client";

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

export async function listConversations(organizationId: string): Promise<Conversation[]> {
  const res = await apiFetch<{ conversations: Conversation[] }>(`/organizations/${organizationId}/conversations`);
  return res.conversations;
}

export async function openRecipientConversation(organizationId: string, recipientId: string): Promise<Conversation> {
  const res = await apiFetch<{ conversation: Conversation }>(
    `/organizations/${organizationId}/care-recipients/${recipientId}/conversation`,
    { method: "POST" }
  );
  return res.conversation;
}

export async function listMessages(
  organizationId: string,
  conversationId: string,
  cursor?: string
): Promise<{ messages: ConversationMessage[]; nextCursor: string | null }> {
  return apiFetch(`/organizations/${organizationId}/conversations/${conversationId}/messages`, { query: { cursor } });
}

export async function sendMessage(
  organizationId: string,
  conversationId: string,
  body: string
): Promise<ConversationMessage> {
  const res = await apiFetch<{ message: ConversationMessage }>(
    `/organizations/${organizationId}/conversations/${conversationId}/messages`,
    { method: "POST", body: { body } }
  );
  return res.message;
}
