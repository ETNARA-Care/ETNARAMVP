import { useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Phone, X } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useAccountSecurity } from "./useAccountSecurity";

const SNOOZE_DAYS = 7;
const snoozeKey = (who: string) => `etnara.phoneReminder.${who}`;
function snoozed(who: string): boolean {
  try { const until = Number(window.localStorage.getItem(snoozeKey(who))); return Number.isFinite(until) && until > Date.now(); } catch { return false; }
}
function snooze(who: string) {
  try { window.localStorage.setItem(snoozeKey(who), String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* private mode: dismissed for this visit only */ }
}

/**
 * Inside the signed-in routes. Only when SMS is on (phoneVerificationAvailable):
 *  - staff created after the cut-off without a verified phone → /security?required=1;
 *  - everyone else without one → a small reminder they can dismiss for 7 days.
 * Existing accounts keep working as today. If the call fails, nothing happens.
 */
export function PhoneRequirement() {
  const location = useLocation();
  const { user } = useAuth();
  const onSecurity = location.pathname === "/security";
  const { security } = useAccountSecurity(!onSecurity);
  const who = user?.id ?? "me";
  const [hidden, setHidden] = useState(() => snoozed(who));

  if (!onSecurity && security?.phoneVerificationAvailable && security.phoneRequired) {
    return <Navigate to="/security?required=1" replace />;
  }

  const remind = !onSecurity && !hidden && !!security?.phoneVerificationAvailable && security.phoneRecommended && !security.phoneRequired;
  return (
    <>
      <Outlet />
      {remind && (
        <div role="status" data-testid="phone-reminder"
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-[var(--z-overlay)] mx-auto flex max-w-[440px] items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-raised)] md:bottom-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ivory-100)] text-[var(--color-navy-700)]"><Phone size={17} aria-hidden /></span>
          <p className="min-w-0 flex-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">
            Vincula tu teléfono para recuperar tu cuenta por SMS.{" "}
            <Link to="/security" className="font-medium text-[var(--color-navy-700)] underline-offset-2 hover:underline">Vincular</Link>
          </p>
          <button type="button" aria-label="Recordármelo más tarde" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-ivory-100)]"
            onClick={() => { snooze(who); setHidden(true); }}>
            <X size={18} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
