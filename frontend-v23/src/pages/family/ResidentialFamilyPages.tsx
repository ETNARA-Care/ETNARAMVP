import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BedDouble, Clock3, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { hasOrgFeature } from "@/auth/orgFeatures";
import { Button, EmptyState, ErrorState, Skeleton, Textarea, useToast } from "@/components/ui";
import { getFamilyTimeline, listMyCareRecipients, type FamilyRecipient, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listMessages, openRecipientConversation, sendMessage, type ConversationMessage } from "@/api/messaging";
import { familyPhotos } from "@/features/activityPhotos/familyPhotos";
import { FamilyPhotoThumb } from "@/features/activityPhotos/FamilyPhotos";
import { useFamilyPhotoViewer } from "@/features/activityPhotos/useFamilyPhotoViewer";
import { useFamilyRefresh } from "@/features/activityPhotos/useFamilyRefresh";
import { familyRecipientName, pickRecipient, useFamilyRecipient } from "@/features/family/familyRecipient";
import { activityText, roleText } from "@/features/residential/familyActivity";
import { isResidentialOrganization } from "@/features/residential/modality";

/**
 * 177 (hogares F5, D5): portal familiar de un hogar. Transparencia solo sobre su familiar:
 * - su hogar y habitación, y el historial de actividades con nombre y puesto de quien las registró, fecha y hora;
 * - mensajes SOLO con la administración del hogar (decisión de Rafa del 26-nov).
 * Nunca turnos, horarios, asignaciones, ponches, asistencia, ubicación, credenciales ni otros residentes: el backend no
 * los envía (API y RLS) y este portal tampoco los pide. Textos completos en español e inglés.
 */
const locale = (lang: string | undefined) => (lang === "en" ? "en-US" : "es-PR");
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function useResidentialFamily() {
  const { activeOrganization } = useAuth();
  const { selectedKey } = useFamilyRecipient();
  const [state, setState] = useState<{ recipient: FamilyRecipient | null; items: FamilyTimelineItem[] } | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setError(false);
    try {
      const recipients = await listMyCareRecipients(token);
      const recipient = pickRecipient(recipients, activeOrganization?.id, selectedKey);
      if (!recipient) { setState({ recipient: null, items: [] }); return; }
      setState({ recipient, items: await getFamilyTimeline(recipient.organizationId, recipient.recipientId, token) });
    } catch { setError(true); }
  }, [activeOrganization, selectedKey]);
  useFamilyRefresh(load);
  return { state, error, load };
}

function ActivityList({ items, organizationId, testId }: { items: FamilyTimelineItem[]; organizationId: string; testId: string }) {
  const { t, i18n } = useTranslation("residential");
  const { activeOrganization } = useAuth();
  const photosOn = hasOrgFeature(activeOrganization?.features, "ACTIVITY_PHOTOS");
  const photos = useMemo(() => (photosOn ? familyPhotos(items) : []), [photosOn, items]);
  const viewer = useFamilyPhotoViewer(organizationId, photos);
  return (
    <>
      <ul className="divide-y divide-[#102b57]/8" data-testid={testId}>
        {items.map((item) => {
          const text = activityText(item);
          const role = roleText(item.caregiver.role);
          const photo = photos.find((p) => p.itemId === item.id);
          return (
            <li key={item.id} className="flex gap-3 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef3e9] text-[#66845f]"><Clock3 size={15} aria-hidden /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-[#173154]">{text.title}</p>
                  <time className="shrink-0 text-xs text-[#667085]">{new Date(item.occurredAt).toLocaleString(locale(i18n.resolvedLanguage), { dateStyle: "short", timeStyle: "short" })}</time>
                </div>
                <p className="mt-0.5 text-sm text-[#667085] [overflow-wrap:anywhere]">{text.summary}</p>
                {item.caregiver.displayName && <p className="mt-1 text-xs font-medium text-[#486d48]">{t("family.author", { name: item.caregiver.displayName, role: role ?? t("family.roleUnknown") })}</p>}
                {photo && <FamilyPhotoThumb organizationId={organizationId} photo={photo} onOpen={viewer.open} className="mt-3 w-full max-w-[16rem]" />}
              </div>
            </li>
          );
        })}
      </ul>
      {viewer.viewer}
    </>
  );
}

export function ResidentialFamilyHome() {
  const { t } = useTranslation("residential");
  const { state, error, load } = useResidentialFamily();
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!state) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (!state.recipient) return <EmptyState title={t("family.noRecipientTitle")} description={t("family.noRecipientDetail")} />;
  const r = state.recipient;
  const today = state.items.filter((i) => isToday(i.occurredAt));
  return (
    <div className="space-y-5" data-testid="residential-family-home">
      <section>
        <p className="text-sm font-medium text-[#486d48]">{t("family.eyebrow")}</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">{familyRecipientName(r)}</h1>
      </section>
      <section className="rounded-[22px] bg-[#102b57] p-5 text-white shadow-sm" data-testid="residential-family-residence">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 text-[#b8c9ad]"><BedDouble size={20} aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#b8c9ad]">{t("family.residence")}</p>
            <p className="mt-1 font-medium">{r.residence?.establishment ?? t("family.notAvailable")}</p>
            <p className="text-sm text-white/80">{r.residence?.room ? t("family.room", { room: r.residence.room }) : t("family.noRoom")}</p>
          </div>
        </div>
        <Link to="/family/messages" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-white underline underline-offset-2"><MessageCircle size={16} aria-hidden />{t("family.writeAdmin")}</Link>
      </section>
      <section className="rounded-[22px] border border-[#102b57]/10 bg-white p-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-[#102b57]">{t("family.todayTitle")}</h2>
          <Link to="/family/activity" className="text-sm font-medium text-[#486d48]">{t("family.seeAll")}</Link>
        </div>
        {today.length === 0 ? <p className="py-3 text-sm text-[#667085]">{t("family.todayEmpty")}</p>
          : <ActivityList items={today.slice(0, 5)} organizationId={r.organizationId} testId="residential-family-today" />}
      </section>
      <p className="px-1 text-xs leading-5 text-[#667085]">{t("family.privacyNote")}</p>
    </div>
  );
}

export function ResidentialFamilyActivity() {
  const { t } = useTranslation("residential");
  const { state, error, load } = useResidentialFamily();
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!state) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  if (!state.recipient) return <EmptyState title={t("family.noRecipientTitle")} description={t("family.noRecipientDetail")} />;
  return (
    <div className="space-y-5" data-testid="residential-family-activity">
      <section>
        <p className="text-sm font-medium text-[#486d48]">{familyRecipientName(state.recipient)}</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">{t("family.historyTitle")}</h1>
        <p className="mt-1 text-sm text-[#667085]">{t("family.historyDetail")}</p>
      </section>
      <section className="rounded-[22px] border border-[#102b57]/10 bg-white px-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
        {state.items.length === 0 ? <p className="py-6 text-center text-sm text-[#667085]">{t("family.historyEmpty")}</p>
          : <ActivityList items={state.items} organizationId={state.recipient.organizationId} testId="residential-family-history" />}
      </section>
      <p className="px-1 text-xs leading-5 text-[#667085]">{t("family.privacyNote")}</p>
    </div>
  );
}

/** Mensajes con la administración del hogar: una conversación por residente (familia y administración, nadie más). */
export function ResidentialFamilyMessages() {
  const { t, i18n } = useTranslation("residential");
  const { user } = useAuth();
  const toast = useToast();
  const { state, error, load } = useResidentialFamily();
  const [thread, setThread] = useState<{ key: string; id: string; messages: ConversationMessage[] } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const recipient = state?.recipient ?? null;
  const key = recipient ? `${recipient.organizationId}:${recipient.recipientId}` : null;
  const loadThread = useCallback(async () => {
    const token = getToken();
    if (!token || !recipient || !key) return;
    try {
      const conversation = await openRecipientConversation(recipient.organizationId, recipient.recipientId, token);
      const { messages } = await listMessages(recipient.organizationId, conversation.id, token);
      setThread({ key, id: conversation.id, messages: [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)) });
    } catch { toast.show(t("family.messagesError"), "danger"); }
  }, [recipient, key, toast, t]);
  useFamilyRefresh(loadThread);
  const current = thread && thread.key === key ? thread : null;
  const send = async () => {
    const token = getToken();
    if (!token || !recipient || !current || !body.trim()) return;
    setSending(true);
    try { await sendMessage(recipient.organizationId, current.id, body.trim(), token); setBody(""); await loadThread(); }
    catch { toast.show(t("family.sendError"), "danger"); }
    finally { setSending(false); }
  };
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!state) return <Skeleton className="h-40" />;
  if (!recipient) return <EmptyState title={t("family.noRecipientTitle")} description={t("family.noRecipientDetail")} />;
  return (
    <div className="space-y-5" data-testid="residential-family-messages">
      <section>
        <p className="text-sm font-medium text-[#486d48]">{familyRecipientName(recipient)}</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">{t("family.messagesTitle")}</h1>
        <p className="mt-1 text-sm text-[#667085]">{t("family.messagesDetail")}</p>
      </section>
      <section className="rounded-[22px] border border-[#102b57]/10 bg-white p-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
        {!current ? <Skeleton className="h-24" /> : current.messages.length === 0 ? <p className="py-3 text-sm text-[#667085]">{t("family.messagesEmpty")}</p> : (
          <ul className="flex flex-col gap-2" data-testid="residential-family-thread">
            {current.messages.map((m) => {
              const mine = m.sender_user_id === user?.id;
              return (
                <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "self-end bg-[#102b57] text-white" : "self-start bg-[#eef3e9] text-[#173154]"}`}>
                  <p className="text-xs font-semibold opacity-80">{mine ? t("family.you") : t("family.administration")}</p>
                  <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{m.body}</p>
                  <time className="mt-1 block text-[0.6875rem] opacity-70">{new Date(m.created_at).toLocaleString(locale(i18n.resolvedLanguage), { dateStyle: "short", timeStyle: "short" })}</time>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <Textarea label={t("family.messageLabel")} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
          <div className="flex justify-end"><Button icon={<Send size={16} aria-hidden />} disabled={sending || !current || !body.trim()} onClick={() => void send()}>{t("family.send")}</Button></div>
        </div>
      </section>
      <p className="px-1 text-xs leading-5 text-[#667085]">{t("family.messagesNote")}</p>
    </div>
  );
}

/** En un hogar, la página de hogar; en agencias e independientes, la de siempre (sin cambios). */
export function ResidentialFamilySwitch({ residential, other }: { residential: ReactNode; other: ReactNode }) {
  const { activeOrganization } = useAuth();
  return <>{isResidentialOrganization(activeOrganization) ? residential : other}</>;
}

/** En un hogar no hay calendario de visitas para la familia (D5): esa ruta lleva al historial de actividades. */
export function ResidentialFamilyHistoryRedirect() { return <Navigate to="/family/activity" replace />; }
