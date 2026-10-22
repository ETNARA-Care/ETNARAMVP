import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, PenSquare, Send } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, IconButton, Modal, Select, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  listConversations,
  listMessages,
  openRecipientConversation,
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

export interface MessagingRecipient { id: string; name: string }

/** "2:14 p. m." hoy, "ayer", o "22 oct". */
function lastMessageTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === yesterday.toDateString()) return "ayer";
  return date.toLocaleDateString("es-PR", { day: "numeric", month: "short" });
}

/**
 * Mensajería real compartida por Familiar, Cuidador y Agencia.
 * `recipients` nombra cada conversación por su residente; `canStart` muestra
 * "Nuevo mensaje" para abrir (o crear) la conversación de un residente.
 */
export function RealMessagingPanel({ conversationTitle = "Equipo de cuidado", recipients = [], canStart = false }: { conversationTitle?: string; recipients?: MessagingRecipient[]; canStart?: boolean }) {
  const { activeOrganization, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ConversationMessage[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [sending, setSending] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedThreadId = searchParams.get("thread");
  const [starting, setStarting] = useState(false);
  const [startRecipient, setStartRecipient] = useState("");
  const [opening, setOpening] = useState(false);
  const nameById = Object.fromEntries(recipients.map((recipient) => [recipient.id, recipient.name]));
  const titleOf = (conversation: Conversation) => (conversation.care_recipient_id && nameById[conversation.care_recipient_id]) || conversationTitle;

  async function startConversation() {
    const token = getToken();
    const organizationId = activeOrganization?.id;
    if (!token || !organizationId || !startRecipient) return;
    setOpening(true);
    try {
      const conversation = await openRecipientConversation(organizationId, startRecipient, token);
      setStarting(false);
      setSearchParams({ thread: conversation.id }, { replace: true });
    } catch (requestError) {
      setError(errorKind(requestError));
      setStarting(false);
    } finally {
      setOpening(false);
    }
  }

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
      setOpenId((current) => {
        if (requestedThreadId && list.some((item) => item.id === requestedThreadId)) return requestedThreadId;
        return current && list.some((item) => item.id === current) ? current : null;
      });
    } catch (requestError) {
      setError(errorKind(requestError));
      setConversations([]);
    }
  }, [activeOrganization?.id, requestedThreadId]);

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

  const startButton = canStart && recipients.length > 0 && (
    <Button variant="secondary" icon={<PenSquare size={17} />} className="self-start" onClick={() => { setStartRecipient(recipients[0]?.id ?? ""); setStarting(true); }}>Nuevo mensaje</Button>
  );
  const startModal = (
    <Modal open={starting} onClose={() => !opening && setStarting(false)} title="Nuevo mensaje" footer={<><Button variant="secondary" disabled={opening} onClick={() => setStarting(false)}>Cancelar</Button><Button loading={opening} disabled={!startRecipient} onClick={() => void startConversation()}>Abrir conversación</Button></>}>
      <div className="flex flex-col gap-3">
        <Select label="¿Sobre qué residente?" value={startRecipient} onChange={(event) => setStartRecipient(event.target.value)}>
          {recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
        </Select>
        <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">La conversación incluye a la familia del residente y al equipo con acceso a su cuidado.</p>
      </div>
    </Modal>
  );

  if (conversations.length === 0) {
    return <div className="flex flex-col gap-3">{startButton}<EmptyState title="Sin conversaciones todavía" description="Las conversaciones autorizadas aparecerán aquí." />{startModal}</div>;
  }

  if (openId) {
    return (
      <ConversationThread
        title={titleOf(conversations.find((item) => item.id === openId) ?? { care_recipient_id: null } as Conversation)}
        messages={messagesByConversation[openId] ?? []}
        currentUserId={user.id}
        sending={sending}
        error={error}
        onSend={(body) => submit(openId, body)}
        onBack={() => {
          setError(null);
          setOpenId(null);
          if (requestedThreadId) setSearchParams({}, { replace: true });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {startButton}
      {error && <ErrorState kind={error} onRetry={() => void load()} />}
      {[...conversations].sort((a, b) => {
        // La conversación con el mensaje más reciente primero.
        const at = (id: string, fallback: string) => { const list = messagesByConversation[id] ?? []; return list[list.length - 1]?.created_at ?? fallback; };
        return at(b.id, b.created_at).localeCompare(at(a.id, a.created_at));
      }).map((conversation) => {
        const messages = messagesByConversation[conversation.id] ?? [];
        const last = messages[messages.length - 1];
        const unread = !!last && last.sender_user_id !== user.id;
        const title = titleOf(conversation);
        return (
          <button key={conversation.id} onClick={() => { setError(null); setOpenId(conversation.id); }} className="text-left">
            <Card className="flex items-center gap-3 rounded-[22px] border-[#102b57]/10 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
              <Avatar name={title} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="min-w-0 flex-1 font-medium text-[var(--color-text-primary)] truncate">{title}</p>
                  {last && <span className="shrink-0 text-[var(--text-caption)] text-[var(--color-text-muted)]">{lastMessageTime(last.created_at)}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 text-[var(--text-small)] text-[var(--color-text-secondary)] truncate">
                    {last ? last.body : "Sin mensajes todavía"}
                  </p>
                  {unread && <Badge tone="accent">Nuevo</Badge>}
                </div>
              </div>
            </Card>
          </button>
        );
      })}
      {startModal}
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
    <div className="flex flex-col h-[calc(100dvh-250px)] min-h-[420px] rounded-[22px] border border-[#102b57]/10 bg-white p-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
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
