import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  listConversations,
  openRecipientConversation,
  listMessages,
  sendMessage,
  type Conversation,
  type ConversationMessage,
} from "../api/messaging";
import { LoadingState, EmptyState, ErrorState } from "../components/UiStates";
import { ApiError } from "../api/client";

export function MessagesPage() {
  const { activeOrganization, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const organizationId = activeOrganization?.id;
  const recipientId = searchParams.get("recipientId");

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    async function load() {
      setLoadingConvos(true);
      setLoadError(null);
      try {
        // Si venimos desde la vista de familia con un recipient especifico,
        // abrimos/reusamos esa conversacion directamente.
        if (recipientId) {
          const conv = await openRecipientConversation(organizationId!, recipientId);
          if (!cancelled) setSelectedId(conv.id);
        }
        const list = await listConversations(organizationId!);
        if (!cancelled) {
          setConversations(list);
          if (!recipientId && list.length > 0) setSelectedId((prev) => prev ?? list[0].id);
        }
      } catch {
        if (!cancelled) setLoadError("No pudimos cargar tus conversaciones.");
      } finally {
        if (!cancelled) setLoadingConvos(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [organizationId, recipientId]);

  useEffect(() => {
    if (!organizationId || !selectedId) return;
    let cancelled = false;
    setLoadingMessages(true);
    setLoadError(null);
    listMessages(organizationId, selectedId)
      .then((res) => {
        if (cancelled) return;
        setMessages([...res.messages].reverse());
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setLoadError("Esta conversación ya no está disponible para ti.");
        } else {
          setLoadError("No pudimos cargar los mensajes.");
        }
      })
      .finally(() => !cancelled && setLoadingMessages(false));
    return () => {
      cancelled = true;
    };
  }, [organizationId, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !organizationId || !selectedId) return;
    setSending(true);
    try {
      const msg = await sendMessage(organizationId, selectedId, body);
      setMessages((prev) => (prev ? [...prev, msg] : [msg]));
      setDraft("");
    } catch {
      setLoadError("No pudimos enviar tu mensaje. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  if (!organizationId) return <LoadingState />;
  if (loadingConvos) return <LoadingState label="Cargando conversaciones..." />;
  if (loadError && !selectedId) return <ErrorState description={loadError} />;

  if (!conversations || conversations.length === 0) {
    return <EmptyState title="Sin conversaciones todavía" description="Cuando inicies una conversación, aparecerá aquí." />;
  }

  return (
    <div className="etnara-messages-layout" style={{ display: "flex", height: "100dvh" }}>
      <aside
        className="etnara-messages-sidebar"
        style={{ width: 260, borderRight: "1px solid var(--color-border)", overflowY: "auto", flexShrink: 0 }}
      >
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              border: "none",
              borderBottom: "1px solid var(--color-border)",
              background: c.id === selectedId ? "var(--color-ink-tint)" : "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: "var(--fs-body)",
              color: "var(--color-ink)",
            }}
          >
            Conversación · {new Date(c.created_at).toLocaleDateString()}
          </button>
        ))}
      </aside>

      <main className="etnara-messages-main" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {loadingMessages && <LoadingState label="Cargando mensajes..." />}
        {!loadingMessages && loadError && <ErrorState description={loadError} />}
        {!loadingMessages && !loadError && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {messages && messages.length === 0 && (
                <EmptyState title="Sin mensajes" description="Envía el primer mensaje para comenzar." />
              )}
              {messages?.map((m) => {
                const isMine = m.sender_user_id === user?.id;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div
                      style={{
                        maxWidth: "70%",
                        background: isMine ? "var(--color-ink)" : "var(--color-surface-muted)",
                        color: isMine ? "#fff" : "var(--color-ink)",
                        borderRadius: 14,
                        padding: "10px 14px",
                        fontFamily: "var(--font-body)",
                        fontSize: "var(--fs-body)",
                      }}
                    >
                      <p style={{ margin: 0 }}>{m.body}</p>
                      <p style={{ margin: "4px 0 0", fontSize: "var(--fs-caption)", opacity: 0.7, fontFamily: "var(--font-mono)" }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid var(--color-border)" }}>
              <label
                htmlFor="message-draft"
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  whiteSpace: "nowrap",
                  border: 0,
                }}
              >
                Escribe un mensaje
              </label>
              <input
                id="message-draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escribe un mensaje..."
                style={{
                  flex: 1,
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--fs-body)",
                  padding: "10px 14px",
                  borderRadius: 20,
                  border: "1px solid var(--color-border)",
                }}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  background: "var(--color-ink)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 20,
                  padding: "10px 20px",
                  cursor: "pointer",
                  opacity: sending || !draft.trim() ? 0.6 : 1,
                }}
              >
                Enviar
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
