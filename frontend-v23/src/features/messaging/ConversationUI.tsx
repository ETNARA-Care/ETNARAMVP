import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, ErrorState, IconButton, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  listConversations,
  listMessages,
  sendMessage,
  type Conversation,
  type ConversationMessage,
} from "@/api/messaging";
import type { ApiError } from "@/api/client";

type ErrorKind = "network" | "server" | "permission";

function errorKind(error: unknown): ErrorKind {
  const apiError = error as ApiError;
  if (apiError?.status === 401 || apiError?.status === 403) return "permission";
  if (apiError?.status === 0) return "network";
  return "server";
}

function ordered(messages: ConversationMessage[]): ConversationMessage[] {
  return [...messages].reverse();
}

/** Mensajería real compartida por Familiar, Cuidador y Agencia. */
export function RealMessagingPanel({ conversationTitle = "Cuidado de Carmen Rivera" }: { conversationTitle?: string }) {
  const { activeOrganization, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ConversationMessage[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId) return;

    setError(null);
    try {
      const list = await listConversations(organizationId, token);
      const loaded = await Promise.all(
        list.map(async (conversation) => {
          const result = await listMessages(organizationId, conversation.id, token);
          return [conversation.id, ordered(result.messages)] as const;
        }),
      );
      setConversations(list);
      setMessagesByConversation(Object.fromEntries(loaded));
      setOpenId((current) => current && list.some((item) => item.id === current) ? current : null);
    } catch (requestError) {
      setError(errorKind(requestError));
      setConversations([]);
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(conversationId: string, body: string) {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId || !body.trim()) return;

    setSending(true);
    setError(null);
    try {
      const message = await sendMessage(organizationId, conversationId, body.trim(), token);
      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: [...(current[conversationId] ?? []), message],
      }));
    } catch (requestError) {
      setError(errorKind(requestError));
      throw requestError;
    } finally {
      setSending(false);
    }
  }

  if (!activeOrganization || !user || conversations === null) {
    return <div className="flex flex-col gap-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  }

  if (error && conversations.length === 0) {
    return <ErrorState kind={error} onRetry={() => void load()} />;
  }

  if (conversations.length === 0) {
    return <EmptyState title="Sin conversaciones todavía" description="Las conversaciones autorizadas aparecerán aquí." />;
  }

  if (openId) {
    return (
      <ConversationThread
        title={conversationTitle}
        messages={messagesByConversation[openId] ?? []}
        currentUserId={user.id}
        sending={sending}
        error={error}
        onSend={(body) => submit(openId, body)}
        onBack={() => { setError(null); setOpenId(null); }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorState kind={error} onRetry={() => void load()} />}
      {conversations.map((conversation) => {
        const messages = messagesByConversation[conversation.id] ?? [];
        const last = messages[messages.length - 1];
        const unread = !!last && last.sender_user_id !== user.id;
        return (
          <button key={conversation.id} onClick={() => { setError(null); setOpenId(conversation.id); }} className="text-left">
            <Card className="flex items-center gap-3">
              <Avatar name={conversationTitle} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">{conversationTitle}</p>
                  {unread && <Badge tone="accent">Nuevo</Badge>}
                </div>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] truncate">
                  {last ? last.body : "Sin mensajes todavía"}
                </p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

function ConversationThread({
  title, messages, currentUserId, sending, error, onSend, onBack,
}: {
  title: string;
  messages: ConversationMessage[];
  currentUserId: string;
  sending: boolean;
  error: ErrorKind | null;
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    try {
      await onSend(draft);
      setDraft("");
    } catch {
      // El estado visible de error se controla en el panel.
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-220px)]">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <IconButton icon={<ArrowLeft size={18} />} label="Volver" onClick={onBack} />
        <p className="font-display text-[var(--text-h3)]">{title}</p>
      </div>
      {error && <ErrorState kind={error} />}
      <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-[var(--text-small)] text-[var(--color-text-muted)] text-center py-6">
            Aún no hay mensajes en esta conversación.
          </p>
        )}
        {messages.map((message) => {
          const mine = message.sender_user_id === currentUserId;
          return (
            <div key={message.id} className={`max-w-[80%] ${mine ? "self-end items-end" : "self-start"} flex flex-col gap-0.5`}>
              <div className={`rounded-[var(--radius-md)] px-3.5 py-2.5 text-[var(--text-body)] ${mine ? "bg-[var(--color-navy-800)] text-white" : "bg-[var(--color-ivory-100)] text-[var(--color-text-primary)]"}`}>
                {message.body}
              </div>
              <span className="text-[var(--text-caption)] text-[var(--color-text-muted)] px-1">
                {mine ? "Tú" : "Mensaje recibido"}
              </span>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Escribe un mensaje..."
          aria-label="Escribe un mensaje"
          disabled={sending}
          className="flex-1 h-11 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 text-[var(--text-body)] disabled:opacity-60"
        />
        <IconButton icon={<Send size={18} />} label="Enviar" type="submit" variant="primary" disabled={sending || !draft.trim()} />
      </form>
    </div>
  );
}
