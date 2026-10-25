import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown, Lock, Moon } from "lucide-react";
import type { EligibleShift } from "@/api/billing";
import { Badge } from "@/components/ui";
import { day, hours, langOf, money, time, tx } from "./billingFormat";

/**
 * Shifts of one client and period (F2.2): approved hours only; overnight shifts
 * show their segments with the rate of each date. Shifts in another draft, with
 * unapproved hours or that need a decision are listed but cannot be selected.
 */
export function EligibleShifts({ shifts, selected, onToggle }: { shifts: EligibleShift[]; selected: Set<string>; onToggle: (id: string) => void }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  return (
    <ul className="flex min-w-0 flex-col gap-2" data-eligible-shifts>
      {shifts.map((s) => {
        const on = selected.has(s.shiftId);
        const overnight = s.segments.length > 1;
        return (
          <li key={s.shiftId} data-shift={s.shiftId} data-selectable={s.selectable ? "yes" : "no"}
            className={`min-w-0 rounded-[var(--radius-md)] border p-3 ${on ? "border-[var(--color-navy-700)] bg-[var(--color-ivory-50)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"} ${s.selectable ? "" : "opacity-80"}`}>
            <label className={`flex min-w-0 items-start gap-3 ${s.selectable ? "cursor-pointer" : "cursor-not-allowed"}`}>
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-navy-900)]" checked={on} disabled={!s.selectable} onChange={() => onToggle(s.shiftId)} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium leading-snug">
                    {day(s.serviceDate, lang)}{overnight && <Moon size={13} className="ml-1 inline text-[var(--color-navy-700)]" aria-hidden />} · {s.serviceName ?? "—"}
                  </p>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{s.amountCents != null ? money(s.amountCents, lang) : "—"}</span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {s.recipientName ?? ""}{s.realStart && s.realEnd ? ` · ${time(s.realStart, lang)}–${time(s.realEnd, lang)}` : ""}{s.approvedMinutes ? ` · ${hours(s.approvedMinutes)}` : ""}
                </p>
                {s.reservedBy && <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><Lock size={12} aria-hidden /><span className="min-w-0 break-all">{t("wizard.reservedBy", { email: s.reservedBy.email })}</span></p>}
                {s.exceptions.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1">{s.exceptions.map((e) => <li key={e}><Badge tone="warning">{tx(t, `exceptions.${e}`, "wizard.notSelectable")}</Badge></li>)}</ul>
                )}
                {s.warnings.map((w) => (
                  <p key={w.code} className="mt-1 flex items-center gap-1 text-xs text-[var(--color-warning-700,#8a5a00)]"><AlertTriangle size={12} aria-hidden />{tx(t, `warnings.${w.code}`, "wizard.notSelectable", { minutes: w.minutes })}</p>
                ))}
              </div>
            </label>
            {overnight && <Segments rows={fromPriced(s.segments)} />}
          </li>
        );
      })}
    </ul>
  );
}

export interface SegmentRow { date: string; startsAt: string; endsAt: string; minutes: number; amount: number; holiday: string | null; source: string | null; price: number | null }
export const fromPriced = (segments: EligibleShift["segments"]): SegmentRow[] => segments.map((s) => ({
  date: s.date, startsAt: s.startsAt, endsAt: s.endsAt, minutes: s.minutes, amount: s.amountCents,
  holiday: s.rate?.holiday ?? null, source: s.rate?.source ?? null, price: s.rate?.amountCents ?? null,
}));

export function Segments({ rows: all }: { rows: SegmentRow[] }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  // A few real seconds before midnight may receive no approved minute (D1): kept in the record, not listed.
  const rows = all.filter((r) => r.minutes > 0);
  return (
    <details className="group mt-2 ml-8 min-w-0 text-xs" data-segments>
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-[var(--color-navy-700)]"><ChevronDown size={13} className="transition group-open:rotate-180" aria-hidden />{t("draft.segments", { count: rows.length })}</summary>
      <ul className="mt-1 space-y-1">
        {rows.map((r) => (
          <li key={r.startsAt} className="flex min-w-0 justify-between gap-2 text-[var(--color-text-secondary)]">
            <span className="min-w-0 break-words">
              {t("draft.segmentLine", { date: day(r.date, lang), from: time(r.startsAt, lang), to: time(r.endsAt, lang), hours: hours(r.minutes) })}
              {r.price != null ? ` · ${money(r.price, lang)}` : ""}{r.source ? ` (${r.source === "client" ? t("draft.clientRate") : t("draft.generalRate")})` : ""}
              {r.holiday ? ` · ${t("draft.holiday", { name: r.holiday })}` : ""}
            </span>
            <span className="shrink-0 tabular-nums">{money(r.amount, lang)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
