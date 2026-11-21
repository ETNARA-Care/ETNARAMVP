import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { LOCALE_TAG } from "@/i18n/language";
import { formatIsoDate } from "./money";

/**
 * Date field for Finanzas (F1.1 visual). iOS draws a native date input in the
 * PHONE's language (10/25/2026 on an English iPhone, even with the app in
 * Spanish) and puts its own calendar glyph over the text on narrow cards. Here
 * the visible box shows the date in the APP's language (i18n) with our icon in
 * its own column, and a transparent native input on top keeps the native
 * picker, the keyboard and the form value (YYYY-MM-DD) exactly as before.
 */
export function DateField({ label, value, onChange, min, max, required, hint, tone = "light" }: {
  label: string; value: string; onChange: (value: string) => void; min?: string; max?: string;
  required?: boolean; hint?: string; tone?: "light" | "dark";
}) {
  const id = useId();
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "en" ? "en" : "es";
  const shown = value ? formatIsoDate(value, language) : language === "en" ? "Choose a date" : "Elige una fecha";
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-date-field>
      <label htmlFor={id} className={`text-[var(--text-small)] font-medium ${tone === "dark" ? "text-white/80" : "text-[var(--color-text-primary)]"}`}>
        {label} {required && <span aria-hidden className="text-[var(--color-danger-700)]">*</span>}
      </label>
      <div className="relative min-w-0">
        <input
          id={id} type="date" lang={LOCALE_TAG[language]} value={value} min={min} max={max} required={required}
          onChange={(e) => onChange(e.target.value)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0"
        />
        <div aria-hidden className="pointer-events-none flex h-11 min-w-0 items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[var(--color-text-primary)] peer-focus-visible:border-[var(--color-navy-700)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-navy-700)]/30">
          <span className={`min-w-0 truncate tabular-nums ${value ? "" : "text-[var(--color-text-muted)]"}`} data-date-text>{shown}</span>
          <CalendarDays size={18} className="shrink-0 text-[var(--color-text-muted)]" />
        </div>
      </div>
      {hint && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
