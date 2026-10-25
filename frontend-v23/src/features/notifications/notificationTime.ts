/**
 * When a notification arrived, in Spanish and in Puerto Rico time:
 * «ahora», «hace 12 min», «hace 3 h» (today), «ayer, 3:15 p. m.»,
 * «martes, 9:00 a. m.» (last 7 days), «12 de octubre» (this year),
 * «12 de octubre de 2025» (older). Never «hace 240 h».
 */
const TZ = "America/Puerto_Rico";
// Kept pure (no i18next) so it stays unit-testable; English since i18n B2.
const WORDS = {
  es: { tag: "es-PR", now: "ahora", min: (n: number) => `hace ${n} min`, h: (n: number) => `hace ${n} h`, yesterday: (time: string) => `ayer, ${time}` },
  en: { tag: "en-US", now: "just now", min: (n: number) => `${n} min ago`, h: (n: number) => `${n} h ago`, yesterday: (time: string) => `yesterday, ${time}` },
} as const;

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD in Puerto Rico
}

function daysBetween(a: Date, b: Date): number {
  const [ya, ma, da] = dayKey(a).split("-").map(Number);
  const [yb, mb, db] = dayKey(b).split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

export function notificationTime(iso: string, now: Date = new Date(), language: "es" | "en" = "es"): string {
  const w = WORDS[language];
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const minutes = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  const days = daysBetween(at, now);
  if (minutes < 1) return w.now;
  if (minutes < 60) return w.min(minutes);
  const time = at.toLocaleTimeString(w.tag, { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  if (days <= 0) return w.h(Math.round(minutes / 60));
  if (days === 1) return w.yesterday(time);
  if (days < 7) return `${at.toLocaleDateString(w.tag, { timeZone: TZ, weekday: "long" })}, ${time}`;
  const sameYear = dayKey(at).slice(0, 4) === dayKey(now).slice(0, 4);
  return at.toLocaleDateString(w.tag, { timeZone: TZ, day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}
