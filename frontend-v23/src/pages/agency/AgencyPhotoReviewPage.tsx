import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, History, Lock, Scale, ShieldAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import {
  deleteActivityPhoto, getActivityPhotoImage, holdAgencyPhoto, legalHoldAgencyPhoto, listAgencyPhotos, reviewAgencyPhoto,
  type ActivityPhotoStatus, type AgencyPhoto,
} from "@/api/activityPhotos";
import { Badge, BottomSheet, Button, Card, EmptyState, ErrorState, Input, PageHeader, Skeleton, Textarea, useToast } from "@/components/ui";
import { PrivateImage } from "@/features/activityPhotos/PrivateImage";
import { PhotoHistory } from "@/features/activityPhotos/PhotoHistory";
import { agencyPhotoErrorKey } from "@/features/activityPhotos/photoErrors";
import { canManageLegalHolds, canReviewPhotos } from "@/features/activityPhotos/permissions";
import { currentLanguage } from "@/i18n";
import { formatDate, formatTime } from "@/i18n/format";

/** v2: historial administrativo (sin aprobación manual). «Retiradas» incluye las antiguas «no compartidas». */
type Tab = "approved" | "pending" | "withdrawn" | "deleted";
const TABS: Tab[] = ["approved", "pending", "withdrawn", "deleted"];
const PAGE = 10;
const ACTIVITY_TYPES = ["MEAL", "HYDRATION", "TOILETING", "MOBILITY", "ACTIVITY", "MOOD", "NOTE", "PHOTO"] as const;
type ActivityKey = (typeof ACTIVITY_TYPES)[number] | "other";
const activityKey = (type: string): ActivityKey => ((ACTIVITY_TYPES as readonly string[]).includes(type) ? type as ActivityKey : "other");

type Action = "withdraw" | "showAgain" | "delete" | "holdPlace" | "holdRenew" | "holdRelease" | "legalPlace" | "legalReview" | "legalRelease";
type Pending = { photo: AgencyPhoto; action: Action } | null;
const NEEDS_DATE: Action[] = ["holdPlace", "holdRenew", "legalPlace", "legalReview"];
const isLegal = (a: Action) => a === "legalPlace" || a === "legalReview" || a === "legalRelease";
const isHold = (a: Action) => a === "holdPlace" || a === "holdRenew" || a === "holdRelease";
/** yyyy-mm-dd local → fin de ese día en Puerto Rico (UTC−4, sin horario de verano). */
const endOfDayPR = (day: string) => new Date(`${day}T23:59:00-04:00`).toISOString();
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Fotos de actividades v2 (V4): historial administrativo de la agencia. Solo
 * administración y supervisión, con ACTIVITY_PHOTOS encendido (FeatureRoute).
 * Sin aprobación manual: las fotos se comparten al enviarse si hay consentimiento
 * y el familiar lo autorizó. Aquí se retiran, se vuelven a mostrar, se eliminan
 * y se retienen; todo queda en el historial. La retención legal es solo de la
 * administración. El backend lo vuelve a comprobar todo en cada petición.
 */
export function AgencyPhotoReviewPage() {
  const { t } = useTranslation("photos");
  const { activeOrganization, roles } = useAuth();
  const { show } = useToast();
  const organizationId = activeOrganization?.id;
  const allowed = canReviewPhotos(roles);
  const legalAllowed = canManageLegalHolds(roles);
  const language = currentLanguage();
  const [tab, setTab] = useState<Tab>("approved");
  const [limit, setLimit] = useState(PAGE);
  const [photos, setPhotos] = useState<AgencyPhoto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [reviewDay, setReviewDay] = useState("");
  const [busy, setBusy] = useState(false);
  // Hora de referencia para las fechas de revisión: se fija al abrir la hoja (no en cada render).
  const [now, setNow] = useState(0);

  // Solo cuenta la última petición: al cambiar de pestaña rápido, una respuesta vieja no pisa la lista nueva.
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !allowed) return;
    const mine = ++requestId.current;
    try {
      const statuses: ActivityPhotoStatus[] = tab === "withdrawn" ? ["withdrawn", "rejected"] : [tab];
      const lists = await Promise.all(statuses.map((status) => listAgencyPhotos(organizationId, token, { status, limit })));
      const rows = lists.flat().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, limit);
      if (mine !== requestId.current) return;
      setPhotos(rows);
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
  const day = useCallback((value: string) => formatDate(value, language, { day: "numeric", month: "short", year: "numeric" }), [language]);

  function chooseTab(next: Tab) {
    setTab(next);
    setLimit(PAGE);
    setPhotos(null);
    setOpenHistory(new Set());
  }

  function start(photo: AgencyPhoto, action: Action) {
    setReason(action === "legalReview" ? photo.legalHold?.basis ?? "" : "");
    setReference(action === "legalReview" ? photo.legalHold?.reference ?? "" : "");
    setReviewDay(NEEDS_DATE.includes(action) ? isoDay(new Date(Date.now() + 30 * 86_400_000)) : "");
    setNow(Date.now());
    setPending({ photo, action });
  }

  const minReason = pending && (isHold(pending.action) || isLegal(pending.action)) ? 10 : 3;
  const reasonOk = pending?.action === "showAgain" || reason.trim().length >= minReason;
  const dateOk = !pending || !NEEDS_DATE.includes(pending.action) || (() => {
    if (!reviewDay) return false;
    const at = Date.parse(endOfDayPR(reviewDay));
    return at > now && at <= now + 90 * 86_400_000;
  })();

  async function confirm() {
    const token = getToken();
    if (!pending || !organizationId || !token || !reasonOk || !dateOk) return;
    const { photo, action } = pending;
    setBusy(true);
    try {
      const reviewAt = reviewDay ? endOfDayPR(reviewDay) : "";
      if (action === "withdraw") await reviewAgencyPhoto(organizationId, photo.id, "WITHDRAW", photo.status, token, reason);
      else if (action === "showAgain") await reviewAgencyPhoto(organizationId, photo.id, "APPROVE", photo.status, token);
      else if (action === "delete") await deleteActivityPhoto(organizationId, photo.id, token, reason);
      else if (action === "holdPlace" || action === "holdRenew") await holdAgencyPhoto(organizationId, photo.id, token, { action: action === "holdPlace" ? "PLACE" : "RENEW", reason: reason.trim(), reviewAt });
      else if (action === "holdRelease") await holdAgencyPhoto(organizationId, photo.id, token, { action: "RELEASE", reason: reason.trim() });
      else if (action === "legalPlace" || action === "legalReview") await legalHoldAgencyPhoto(organizationId, photo.id, token,
        { action: action === "legalPlace" ? "PLACE" : "REVIEW", basis: reason.trim(), ...(reference.trim() ? { reference: reference.trim() } : {}), reviewAt });
      else await legalHoldAgencyPhoto(organizationId, photo.id, token, { action: "RELEASE", basis: reason.trim() });
      show(t(action === "withdraw" ? "review.withdrawn" : action === "showAgain" ? "review.shownAgain" : action === "delete" ? "review.deleted"
        : isLegal(action) ? "review.legalSaved" : "review.holdSaved"), "success");
      setPending(null);
      await load();
    } catch (error) {
      const { key, code } = agencyPhotoErrorKey(error);
      show(t(key, { code }), "danger");
      if (["agencyErrors.statusChanged", "agencyErrors.invalidTransition", "agencyErrors.notFound", "agencyErrors.holdExists", "agencyErrors.alreadyDeleted"].includes(key)) {
        setPending(null); await load();
      }
    } finally {
      setBusy(false);
    }
  }

  const tabs = useMemo(() => TABS.map((id) => ({ id, label: t(`review.tabs.${id}`) })), [t]);
  const sheetTitle = (a: Action) => t(a === "withdraw" ? "review.withdrawTitle" : a === "showAgain" ? "review.showAgainTitle" : a === "delete" ? "review.deleteTitle"
    : isLegal(a) ? "review.legalTitle" : "review.holdTitle");

  if (!allowed) return <ErrorState kind="permission" />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="agency-photo-review">
      <PageHeader title={t("review.title")} description={t("review.description")} />

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
      {!failed && photos?.length === 0 && <EmptyState icon={<Camera size={28} />} title={t("review.emptyOther")} />}

      {!failed && photos && photos.length > 0 && (
        <>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" data-testid="photo-count">{t("review.count", { count: photos.length })}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo) => {
              const historyOpen = openHistory.has(photo.id);
              const deleted = photo.status === "deleted";
              const held = photo.hold?.active === true;
              const legal = photo.legalHold;
              return (
                <Card key={photo.id} className="flex flex-col gap-3 !p-0 overflow-hidden" data-testid="agency-photo-card" data-photo-id={photo.id} data-status={photo.status}>
                  {photo.viewable ? (
                    <PrivateImage
                      load={() => { const token = getToken(); return token && organizationId ? getActivityPhotoImage(organizationId, photo.id, token) : Promise.reject(new Error("NO_SESSION")); }}
                      alt={t("review.imageAlt", { activity: activityLabel(photo.activity.type), name: photo.careRecipientName })}
                      unavailableLabel={t("review.imageUnavailable")}
                      className="aspect-[4/3] w-full"
                      testId="agency-photo-image"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-[var(--color-ivory-100)] px-4 text-center text-[var(--text-caption)] text-[var(--color-text-muted)]" data-testid="agency-photo-tombstone">
                      <Lock size={20} aria-hidden />
                      {deleted && photo.deletion
                        ? t("review.deletedOn", { date: day(photo.deletion.at), kind: t(`review.deletionKind.${photo.deletion.kind}`) })
                        : t("review.expired")}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-text-primary)]">{photo.careRecipientName}</p>
                        <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{activityLabel(photo.activity.type)} · {when(photo.activity.occurredAt)}</p>
                      </div>
                      <Badge tone={photo.status === "approved" ? "success" : deleted ? "danger" : "neutral"}>{t(`status.${photo.status}`)}</Badge>
                    </div>
                    <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{photo.caregiverName ? t("review.takenBy", { name: photo.caregiverName }) : t("review.takenByUnknown")}</p>
                    {photo.activity.note && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.note", { note: photo.activity.note })}</p>}
                    {!deleted && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" data-testid="photo-available-until">
                      {photo.expired ? t("review.expired") : t("review.availableUntil", { date: day(photo.availableUntil) })}</p>}
                    {photo.status === "pending" && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.agencyOnlyNote")}</p>}
                    {photo.reviewReason && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.reviewedReason", { reason: photo.reviewReason })}</p>}
                    {held && photo.hold && (
                      <p className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] px-3 py-2 text-[var(--text-caption)] text-[var(--color-text-secondary)]" data-testid="photo-hold">
                        {t("review.holdActive", { date: day(photo.hold.reviewAt) })} · {t("review.holdUsed", { used: photo.hold.actionsUsed, max: photo.hold.actionsMax })}<br />
                        {t("review.reviewedReason", { reason: photo.hold.reason })}
                      </p>
                    )}
                    {legal && (
                      <p className={`flex items-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-caption)] ${legal.reviewOverdue ? "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" : "bg-[var(--color-ivory-100)] text-[var(--color-text-secondary)]"}`} data-testid="photo-legal-hold">
                        <Scale size={16} aria-hidden className="mt-0.5 shrink-0" />
                        <span>{t("review.legalActive", { date: day(legal.reviewAt) })}{legal.reference ? ` · ${legal.reference}` : ""}<br />{legal.basis}
                          {legal.reviewOverdue && <><br /><strong>{t("review.legalOverdue")}</strong></>}</span>
                      </p>
                    )}
                  </div>
                  {!deleted && (
                    <div className="flex flex-wrap gap-2 px-4">
                      {photo.status === "approved" && !photo.expired && <Button size="sm" variant="danger" data-testid="photo-withdraw" onClick={() => start(photo, "withdraw")}>{t("review.withdraw")}</Button>}
                      {(photo.status === "withdrawn" || photo.status === "rejected") && photo.sharedAt && !photo.expired && (
                        <Button size="sm" variant="secondary" data-testid="photo-show-again" onClick={() => start(photo, "showAgain")}>{t("review.showAgain")}</Button>
                      )}
                      {!photo.expired && !held && <Button size="sm" variant="secondary" data-testid="photo-hold-place" onClick={() => start(photo, "holdPlace")}>{t("review.hold")}</Button>}
                      {held && <>
                        <Button size="sm" variant="secondary" data-testid="photo-hold-renew" disabled={(photo.hold?.actionsUsed ?? 0) >= (photo.hold?.actionsMax ?? 3)} onClick={() => start(photo, "holdRenew")}>{t("review.holdRenew")}</Button>
                        <Button size="sm" variant="secondary" data-testid="photo-hold-release" onClick={() => start(photo, "holdRelease")}>{t("review.holdRelease")}</Button>
                      </>}
                      {legalAllowed && !legal && <Button size="sm" variant="secondary" data-testid="photo-legal-place" icon={<Scale size={14} />} onClick={() => start(photo, "legalPlace")}>{t("review.legal")}</Button>}
                      {legalAllowed && legal && <>
                        <Button size="sm" variant="secondary" data-testid="photo-legal-review" onClick={() => start(photo, "legalReview")}>{t("review.legalReview")}</Button>
                        <Button size="sm" variant="secondary" data-testid="photo-legal-release" onClick={() => start(photo, "legalRelease")}>{t("review.legalRelease")}</Button>
                      </>}
                      {!held && !legal && <Button size="sm" variant="ghost" data-testid="photo-delete" onClick={() => start(photo, "delete")}>{t("review.delete")}</Button>}
                    </div>
                  )}
                  <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-2">
                    <button type="button" className="flex min-h-11 items-center gap-2 text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]" data-testid="photo-history-toggle"
                      aria-expanded={historyOpen}
                      onClick={() => setOpenHistory((current) => { const next = new Set(current); if (next.has(photo.id)) next.delete(photo.id); else next.add(photo.id); return next; })}>
                      <History size={16} aria-hidden />{historyOpen ? t("review.hideHistory") : t("review.history")}
                    </button>
                    {historyOpen && organizationId && <PhotoHistory organizationId={organizationId} photoId={photo.id}
                      version={`${photo.status}-${photo.reviewedAt ?? ""}-${photo.hold?.reviewAt ?? ""}-${photo.legalHold?.reviewAt ?? ""}`} />}
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
        title={pending ? sheetTitle(pending.action) : ""}
        footer={<>
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => setPending(null)}>{t("review.cancel")}</Button>
          <Button fullWidth variant={pending?.action === "withdraw" || pending?.action === "delete" ? "danger" : "primary"} loading={busy} disabled={!reasonOk || !dateOk}
            data-testid="photo-decision-confirm" onClick={() => void confirm()}>{t("review.confirm")}</Button>
        </>}
      >
        {pending && (
          <div className="flex flex-col gap-3" data-testid="photo-decision-sheet" data-action={pending.action}>
            {pending.action === "showAgain" && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("review.showAgainBody", { name: pending.photo.careRecipientName })}</p>}
            {pending.action === "withdraw" && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("review.withdrawWarning")}</p>}
            {pending.action === "delete" && (
              <p className="flex items-start gap-2 text-[var(--text-small)] text-[var(--color-danger-700)]"><ShieldAlert size={16} aria-hidden className="mt-0.5 shrink-0" />{t("review.deleteWarning")}</p>
            )}
            {isHold(pending.action) && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.holdNote")}</p>}
            {isLegal(pending.action) && <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">{t("review.legalNote")}</p>}
            {pending.action !== "showAgain" && <>
              <Textarea label={isLegal(pending.action) && pending.action !== "legalRelease" ? t("review.legalBasis") : isHold(pending.action) ? t("review.holdReason") : t("review.reasonLabel")}
                value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} data-testid="photo-decision-reason" />
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("review.reasonHint")}</p>
            </>}
            {(pending.action === "legalPlace" || pending.action === "legalReview") && (
              <Input label={t("review.legalReference")} value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} data-testid="photo-legal-reference" />
            )}
            {NEEDS_DATE.includes(pending.action) && (
              <Input type="date" label={t("review.reviewDate")} value={reviewDay} min={isoDay(new Date(now + 86_400_000))} max={isoDay(new Date(now + 89 * 86_400_000))}
                onChange={(event) => setReviewDay(event.target.value)} data-testid="photo-review-date" />
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
