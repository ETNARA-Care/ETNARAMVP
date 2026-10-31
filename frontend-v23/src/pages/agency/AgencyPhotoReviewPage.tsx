import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Camera, History, ShieldAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  getActivityPhotoImage, listAgencyPhotos, listPhotoConsents, reviewAgencyPhoto,
  type ActivityPhotoStatus, type AgencyPhoto, type PhotoDecision,
} from "@/api/activityPhotos";
import { Badge, BottomSheet, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, Textarea, useToast } from "@/components/ui";
import { PrivateImage } from "@/features/activityPhotos/PrivateImage";
import { PhotoHistory } from "@/features/activityPhotos/PhotoHistory";
import { agencyPhotoErrorKey } from "@/features/activityPhotos/photoErrors";
import { canReviewPhotos } from "@/features/activityPhotos/permissions";
import { currentLanguage } from "@/i18n";
import { formatDate, formatTime } from "@/i18n/format";

const TABS: ActivityPhotoStatus[] = ["pending", "approved", "rejected", "withdrawn"];
const PAGE = 10;
const TONE = { pending: "warning", approved: "success", rejected: "neutral", withdrawn: "neutral" } as const;
const ACTIVITY_TYPES = ["MEAL", "HYDRATION", "TOILETING", "MOBILITY", "ACTIVITY", "MOOD", "NOTE", "PHOTO"] as const;
type ActivityKey = (typeof ACTIVITY_TYPES)[number] | "other";
const activityKey = (type: string): ActivityKey => ((ACTIVITY_TYPES as readonly string[]).includes(type) ? type as ActivityKey : "other");

type Pending = { photo: AgencyPhoto; decision: PhotoDecision } | null;

/**
 * Fotos de actividades (E2): solo administración y supervisión de la agencia,
 * y solo con ACTIVITY_PHOTOS encendido (la ruta va dentro de FeatureRoute).
 * La familia solo ve lo que aquí se comparte.
 */
export function AgencyPhotoReviewPage() {
  const { t } = useTranslation("photos");
  const { activeOrganization, roles } = useAuth();
  const { show } = useToast();
  const organizationId = activeOrganization?.id;
  const allowed = canReviewPhotos(roles);
  const language = currentLanguage();
  const [tab, setTab] = useState<ActivityPhotoStatus>("pending");
  const [limit, setLimit] = useState(PAGE);
  const [photos, setPhotos] = useState<AgencyPhoto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [noShareConsent, setNoShareConsent] = useState<Set<string>>(new Set());
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Solo cuenta la última petición: al cambiar de pestaña rápido, una respuesta vieja no pisa la lista nueva.
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !allowed) return;
    const mine = ++requestId.current;
    try {
      const rows = await listAgencyPhotos(organizationId, token, { status: tab, limit });
      // Aviso previo: residentes de esta página sin consentimiento vigente para compartir con la familia.
      const recipients = [...new Set(rows.map((row) => row.careRecipientId))];
      const missing = await Promise.all(recipients.map((id) => listPhotoConsents(organizationId, id, token)
        .then((consents) => (consents.some((c) => c.type === "PHOTO_SHARE_FAMILY" && c.active) ? null : id))
        .catch(() => null)));
      if (mine !== requestId.current) return;
      setPhotos(rows);
      setNoShareConsent(new Set(missing.filter((id): id is string => id !== null)));
      setFailed(false);
    } catch {
      if (mine === requestId.current) setFailed(true);
    }
  }, [organizationId, tab, limit, allowed]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const activityLabel = useCallback((type: string) => t(`activityType.${activityKey(type)}`), [t]);
  const when = useCallback((value: string) => t("review.at", {
    date: formatDate(value, language, { weekday: "short", day: "numeric", month: "short" }), time: formatTime(value, language),
  }), [t, language]);

  function chooseTab(next: ActivityPhotoStatus) {
    setTab(next);
    setLimit(PAGE);
    setPhotos(null);
    setOpenHistory(new Set());
  }

  function startDecision(photo: AgencyPhoto, decision: PhotoDecision) {
    setReason("");
    setPending({ photo, decision });
  }

  const needsReason = pending?.decision === "REJECT" || pending?.decision === "WITHDRAW";
  const reasonOk = !needsReason || reason.trim().length >= 3;

  async function confirmDecision() {
    const token = getToken();
    if (!pending || !organizationId || !token || !reasonOk) return;
    setBusy(true);
    try {
      await reviewAgencyPhoto(organizationId, pending.photo.id, pending.decision, pending.photo.status, token, needsReason ? reason : undefined);
      show(t(pending.decision === "APPROVE" ? "review.shared" : pending.decision === "REJECT" ? "review.rejected" : "review.withdrawn"), "success");
      setPending(null);
      await load();
    } catch (error) {
      const { key, code } = agencyPhotoErrorKey(error);
      show(t(key, { code }), "danger");
      // Otra persona la revisó primero: se cierra y se recarga para ver el estado real.
      if (key === "agencyErrors.statusChanged" || key === "agencyErrors.invalidTransition" || key === "agencyErrors.notFound") { setPending(null); await load(); }
    } finally {
      setBusy(false);
    }
  }

  const tabs = useMemo(() => TABS.map((id) => ({ id, label: t(`review.tabs.${id}`) })), [t]);

  if (!allowed) return <ErrorState kind="permission" />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="agency-photo-review">
      <PageHeader title={t("review.title")} description={t("review.description")} />

      {/* Pestañas desplazables (cuatro listas en 390 px). */}
      <div role="tablist" aria-label={t("review.title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} data-testid={`photo-tab-${item.id}`}
            onClick={() => chooseTab(item.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-[var(--text-small)] font-medium transition-colors ${tab === item.id
              ? "border-[var(--color-navy-900)] bg-[var(--color-navy-900)] text-white"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {failed && <Card><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("review.loadFailed")}</p><Button size="sm" variant="secondary" className="mt-2" onClick={() => void load()}>{t("review.retry")}</Button></Card>}
      {!failed && photos === null && <div className="flex flex-col gap-3"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>}
      {!failed && photos?.length === 0 && (
        <EmptyState icon={<Camera size={28} />} title={tab === "pending" ? t("review.emptyPending") : t("review.emptyOther")} />
      )}

      {!failed && photos && photos.length > 0 && (
        <>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" data-testid="photo-count">{t("review.count", { count: photos.length })}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo) => {
              const historyOpen = openHistory.has(photo.id);
              const shareBlocked = noShareConsent.has(photo.careRecipientId);
              return (
                <Card key={photo.id} className="flex flex-col gap-3 !p-0 overflow-hidden" data-testid="agency-photo-card" data-photo-id={photo.id}>
                  <PrivateImage
                    load={() => { const token = getToken(); return token && organizationId ? getActivityPhotoImage(organizationId, photo.id, token) : Promise.reject(new Error("NO_SESSION")); }}
                    alt={t("review.imageAlt", { activity: activityLabel(photo.activity.type), name: photo.careRecipientName })}
                    unavailableLabel={t("review.imageUnavailable")}
                    className="aspect-[4/3] w-full"
                    testId="agency-photo-image"
                  />
                  <div className="flex flex-col gap-2 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-text-primary)]">{photo.careRecipientName}</p>
                        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{activityLabel(photo.activity.type)} · {when(photo.activity.occurredAt)}</p>
                      </div>
                      <Badge tone={TONE[photo.status]}>{t(`status.${photo.status}`)}</Badge>
                    </div>
                    <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{photo.caregiverName ? t("review.takenBy", { name: photo.caregiverName }) : t("review.takenByUnknown")}</p>
                    {photo.activity.note && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.note", { note: photo.activity.note })}</p>}
                    {photo.reviewReason && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.reviewedReason", { reason: photo.reviewReason })}</p>}
                    {shareBlocked && (photo.status === "pending" || photo.status === "rejected" || photo.status === "withdrawn") && (
                      <p className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] px-3 py-2 text-[var(--text-caption)] text-[var(--color-text-secondary)]" data-testid="photo-no-share-consent">
                        <ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                        <span>{t("review.noShareConsent")} <Link className="font-medium underline" to={`/agency/residents/${photo.careRecipientId}`}>{t("review.openResident")}</Link></span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 px-4">
                    {photo.status === "pending" && <>
                      <Button size="sm" data-testid="photo-approve" disabled={shareBlocked} onClick={() => startDecision(photo, "APPROVE")}>{t("review.share")}</Button>
                      <Button size="sm" variant="secondary" data-testid="photo-reject" onClick={() => startDecision(photo, "REJECT")}>{t("review.reject")}</Button>
                    </>}
                    {photo.status === "approved" && <Button size="sm" variant="danger" data-testid="photo-withdraw" onClick={() => startDecision(photo, "WITHDRAW")}>{t("review.withdraw")}</Button>}
                    {(photo.status === "rejected" || photo.status === "withdrawn") && (
                      <Button size="sm" variant="secondary" data-testid="photo-approve" disabled={shareBlocked} onClick={() => startDecision(photo, "APPROVE")}>{t("review.shareAgain")}</Button>
                    )}
                  </div>
                  <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-2">
                    <button type="button" className="flex min-h-11 items-center gap-2 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]" data-testid="photo-history-toggle"
                      aria-expanded={historyOpen}
                      onClick={() => setOpenHistory((current) => { const next = new Set(current); if (next.has(photo.id)) next.delete(photo.id); else next.add(photo.id); return next; })}>
                      <History size={16} aria-hidden />{historyOpen ? t("review.hideHistory") : t("review.history")}
                    </button>
                    {historyOpen && organizationId && <PhotoHistory organizationId={organizationId} photoId={photo.id} version={`${photo.status}-${photo.reviewedAt ?? ""}`} />}
                  </div>
                </Card>
              );
            })}
          </div>
          {photos.length >= limit && limit < 100 && (
            <Button variant="secondary" onClick={() => setLimit((current) => Math.min(100, current + PAGE))} data-testid="photo-load-more">{t("review.loadMore")}</Button>
          )}
        </>
      )}

      <BottomSheet
        open={!!pending}
        onClose={() => !busy && setPending(null)}
        title={pending?.decision === "REJECT" ? t("review.rejectTitle") : pending?.decision === "WITHDRAW" ? t("review.withdrawTitle") : t("review.confirmShareTitle")}
        footer={<>
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => setPending(null)}>{t("review.cancel")}</Button>
          <Button fullWidth variant={pending?.decision === "WITHDRAW" ? "danger" : "primary"} loading={busy} disabled={!reasonOk} data-testid="photo-decision-confirm" onClick={() => void confirmDecision()}>{t("review.confirm")}</Button>
        </>}
      >
        <div className="flex flex-col gap-3" data-testid="photo-decision-sheet">
          {pending?.decision === "APPROVE" && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("review.confirmShareBody", { name: pending.photo.careRecipientName })}</p>}
          {pending?.decision === "WITHDRAW" && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("review.withdrawWarning")}</p>}
          {needsReason && <>
            <Textarea label={t("review.reasonLabel")} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} data-testid="photo-decision-reason" />
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("review.reasonHint")}</p>
          </>}
        </div>
      </BottomSheet>
    </div>
  );
}
