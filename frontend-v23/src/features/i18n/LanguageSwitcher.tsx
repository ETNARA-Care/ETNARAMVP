import { useTranslation } from "react-i18next";
import { setLanguage } from "@/i18n";
import { LANGUAGES, type Language } from "@/i18n/language";

/**
 * «ES | EN». Changes the language at once (no reload, no sign-out; what is typed
 * in a form stays) and remembers it on this device. `tone` matches the surface.
 */
export function LanguageSwitcher({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const { t, i18n } = useTranslation("common");
  const active: Language = i18n.resolvedLanguage === "en" ? "en" : "es";
  const base = tone === "dark"
    ? "border-white/20 bg-white/5 text-white/70"
    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]";
  const on = tone === "dark" ? "bg-white text-[var(--color-navy-950)]" : "bg-[var(--color-navy-900)] text-white";
  return (
    <div role="group" aria-label={t("language.label")} data-testid="language-switcher"
      className={`inline-flex items-center rounded-full border p-0.5 text-[length:0.8125rem] font-semibold tracking-[0.06em] ${base} ${className}`}>
      {LANGUAGES.map((language) => {
        const selected = language === active;
        return (
          <button key={language} type="button" lang={language === "en" ? "en" : "es"}
            aria-pressed={selected}
            aria-label={t("language.switchTo", { language: t(`language.${language}`) })}
            onClick={() => { if (!selected) setLanguage(language); }}
            className={`min-h-9 min-w-11 rounded-full px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? on : "hover:text-current"}`}>
            {language.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
