import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { IconButton, Badge } from "@/components/ui";
import { useNotifications } from "./useNotifications";
import { notificationTime } from "./notificationTime";

/** Campana conectada a la bandeja real del usuario autenticado. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { items, unread, error, reload, markRead, markAllRead } = useNotifications();
  const { t, i18n } = useTranslation("common");
  const language = i18n.resolvedLanguage === "en" ? "en" : "es";

  async function openNotification(notification: NonNullable<typeof items>[number]) {
    await markRead(notification.id);
    setOpen(false);
    const { type, relatedEntityType: entityType, relatedEntityId: entityId, shiftId, careRecipientId, workerMembershipId } = notification;
    const portal = location.pathname.startsWith("/family")
      ? "family"
      : location.pathname.startsWith("/caregiver") ? "caregiver" : "agency";

    // SmartMatch: open the exact application (agency review) or the caregiver's own list.
    if (entityType === "smartmatch_application" && entityId) {
      if (type === "SMARTMATCH_APPLICATION_SUBMITTED") navigate(`/agency/smartmatch?application=${entityId}`);
      else navigate(`/caregiver/smartmatch?tab=mine&application=${entityId}`);
      return;
    }

    // Gate 6: arrivals, address changes and family correction requests (never carry the address).
    if ((type === "SHIFT_LATE_ARRIVAL" || type === "SHIFT_ARRIVAL_NEEDS_REVIEW" || type === "TIMESHEET_NEEDS_REVIEW") && shiftId) {
      navigate(`/agency/shifts/${shiftId}`);
      return;
    }
    // Informe de Turno F2 (128): the caregiver opens her own report.
    if ((type === "SHIFT_REPORT_READY" || type === "SHIFT_REPORT_RETURNED") && entityId) { navigate(`/caregiver/shift-reports/${entityId}`); return; }
    // Migration 113: cancellation / reassignment. A removed caregiver no longer has the shift: open her list.
    if ((type === "SHIFT_CANCELLED" || type === "SHIFT_RESCHEDULED") && shiftId) { navigate(`/caregiver/shifts/${shiftId}`); return; }
    if (type === "SHIFT_UNASSIGNED") { navigate("/caregiver/shifts"); return; }
    if (type === "FAMILY_VISIT_CANCELLED" || type === "FAMILY_CAREGIVER_CHANGED") { navigate("/family"); return; }
    // Gate 7: journey notices.
    if (type === "FAMILY_CAREGIVER_EN_ROUTE" || type === "FAMILY_CAREGIVER_DELAYED" || type === "FAMILY_CAREGIVER_ARRIVED") {
      navigate("/family");
      return;
    }
    if ((type === "SHIFT_NOT_EN_ROUTE" || type === "SHIFT_DELAY_REPORTED") && shiftId) {
      navigate(`/agency/shifts/${shiftId}`);
      return;
    }
    if (type === "SHIFT_LOCATION_CHANGED" && shiftId) {
      navigate(`/caregiver/shifts/${shiftId}`);
      return;
    }
    if (type === "LOCATION_CHANGE_REQUESTED" && careRecipientId) {
      navigate(`/agency/residents/${careRecipientId}`);
      return;
    }
    if (type === "LOCATION_CHANGE_APPROVED" || type === "LOCATION_CHANGE_REJECTED") {
      navigate("/family/profile");
      return;
    }

    if (entityType === "incident" && entityId) {
      if (portal === "family") navigate(`/family/incidents/${entityId}`);
      if (portal === "agency") navigate(`/agency/incidents/${entityId}`);
      return;
    }
    if (type.startsWith("SHIFT_ASSIGNMENT_") && shiftId) {
      navigate(portal === "caregiver" ? `/caregiver/shifts/${shiftId}` : `/agency/shifts/${shiftId}`);
      return;
    }
    if (type.startsWith("OPEN_SHIFT_")) {
      navigate(portal === "caregiver" ? "/caregiver/shifts" : "/agency/shifts");
      return;
    }
    if ((type === "SHIFT_STARTED" || type === "SHIFT_COMPLETED") && shiftId) {
      navigate(portal === "family" ? "/family" : `/agency/shifts/${shiftId}`);
      return;
    }
    if (entityType === "message_thread" && entityId) {
      navigate(`/${portal}/messages?thread=${entityId}`);
      return;
    }
    if (type === "CREDENTIAL_REVIEW_PENDING" && portal === "agency") {
      navigate("/agency/compliance#credential-review-queue");
      return;
    }
    if ((type === "CREDENTIAL_REVIEW_APPROVED" || type === "CREDENTIAL_REVIEW_REJECTED") && portal === "caregiver") {
      navigate("/caregiver/profile#my-credentials");
      return;
    }
    if (entityType === "credential" && portal === "agency" && workerMembershipId) {
      navigate(`/agency/workers/${workerMembershipId}`);
      return;
    }
    if (entityType === "operational_alert" && portal === "agency") {
      navigate("/agency/operations");
      return;
    }
    if (type === "NEW_CARE_EVENT") {
      if (portal === "family") navigate("/family/activity");
      if (portal === "agency" && careRecipientId) navigate(`/agency/residents/${careRecipientId}`);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void reload();
  }

  return (
    <div className="relative">
      <div className="relative">
        <IconButton
          icon={<Bell size={20} />}
          label={unread > 0 ? t("notifications.bellUnread", { count: unread }) : t("notifications.bell")}
          onClick={toggle}
        />
        {unread > 0 && (
          <span
            aria-hidden
            data-testid="notification-count"
            className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full
              bg-[var(--color-danger-700)] px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-[var(--color-surface)]"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[var(--z-overlay)]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label={t("notifications.title")}
            // Phones: pinned to the screen with 12 px gutters, whatever sits right of the bell in each
            // portal's header. From 640 px: the usual drop-down under the bell.
            className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-[var(--z-modal)]
              sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[320px]
              bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)]
              shadow-[var(--shadow-raised)] overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-[var(--color-border)]">
              <p className="min-w-0 truncate font-medium text-[var(--text-body)] text-[var(--color-text-primary)]">{t("notifications.title")}</p>
              {unread > 0 && (
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                  {/* The bell already shows the count; on phones the title and «Marcar todas» need the room. */}
                  <span className="hidden sm:inline-flex"><Badge tone="accent">{t("notifications.unread", { count: unread })}</Badge></span>
                  <button type="button" onClick={() => void markAllRead()}
                    className="min-h-8 rounded-md px-1.5 text-[var(--text-caption)] font-medium text-[var(--color-accent-700)] hover:underline">
                    {t("notifications.markAll")}
                  </button>
                </span>
              )}
            </div>
            <div className="max-h-[min(360px,calc(100dvh-8rem))] overflow-y-auto overscroll-contain">
              {error ? (
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="w-full text-[var(--text-small)] text-[var(--color-danger-700)] text-center py-6 px-3"
                >
                  {t("notifications.error")}
                </button>
              ) : items === null ? (
                <p className="text-[var(--text-small)] text-[var(--color-text-muted)] text-center py-6 px-3">
                  {t("notifications.loading")}
                </p>
              ) : items.length === 0 ? (
                <p className="text-[var(--text-small)] text-[var(--color-text-muted)] text-center py-6 px-3">
                  {t("notifications.empty")}
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => void openNotification(n)}
                    className={`w-full text-left flex items-start gap-2 px-3.5 py-3 border-b border-[var(--color-border)] last:border-b-0
                      transition-colors hover:bg-[var(--color-ivory-100)]
                      ${n.readAt ? "" : "bg-[var(--color-accent-100)]/40"}`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.readAt ? "bg-transparent" : "bg-[var(--color-accent-700)]"}`}
                    />
                    <span className="flex-1">
                      <span className="block text-[var(--text-small)] text-[var(--color-text-primary)]">{n.summary}</span>
                      <span className="block text-[var(--text-caption)] text-[var(--color-text-muted)] mt-0.5">{notificationTime(n.createdAt, new Date(), language)}</span>
                    </span>
                    {!n.readAt && <Check size={14} className="text-[var(--color-text-muted)] mt-1.5" aria-hidden />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
