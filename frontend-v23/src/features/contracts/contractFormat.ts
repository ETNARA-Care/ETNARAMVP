import type { ContractAcceptanceState } from "@/api/contracts";

/** Fecha y hora en Puerto Rico, legible. */
export const contractDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-PR", { timeZone: "America/Puerto_Rico", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
export const contractDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PR", { timeZone: "America/Puerto_Rico", day: "numeric", month: "short", year: "numeric" });

/** Estado para la agencia y para Central (mismo vocabulario). */
export function acceptanceLabel(state: ContractAcceptanceState, isNewVersion = false): { label: string; tone: "success" | "warning" | "neutral" } {
  if (state === "accepted") return { label: "Aceptado", tone: "success" };
  if (state === "covered") return { label: "Vigente por aceptación anterior", tone: "neutral" };
  return { label: isNewVersion ? "Nueva versión: requiere aceptación" : "Pendiente de aceptación", tone: "warning" };
}

/** Nombre completo: al menos nombre y apellido (igual que el servidor). */
export const validFullName = (v: string) => { const t = v.trim(); return t.length >= 5 && t.length <= 150 && /\S+\s+\S+/.test(t); };
export const validTitle = (v: string) => { const t = v.trim(); return t.length >= 2 && t.length <= 100; };
export const validCode = (v: string) => /^[0-9]{6}$/.test(v);
export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-8)}`;

/** Condiciones de una Orden de Suscripción en lenguaje claro (153). Solo informativo. */
export function orderTermsLines(t: { freeMonth?: boolean; freeDays?: number; premiumTrial?: boolean; basicPlanMonthlyUsd?: number; premiumAddOns?: string; chargesRequireExpressAcceptance?: boolean; billingActivated?: boolean }): string[] {
  const out: string[] = [];
  if (t.freeMonth) out.push(`Primer mes sin costo${t.freeDays ? ` (${t.freeDays} días)` : ""}.`);
  if (t.premiumTrial) out.push("Acceso premium temporal durante el período sin costo.");
  if (typeof t.basicPlanMonthlyUsd === "number") out.push(`Después, plan básico de US$${t.basicPlanMonthlyUsd} al mes.`);
  if (t.premiumAddOns) out.push(`Funciones premium adicionales: ${t.premiumAddOns}`);
  if (t.chargesRequireExpressAcceptance) out.push("Ningún cargo ni renovación sin tu aceptación expresa.");
  if (t.billingActivated === false) out.push("La facturación no está activada.");
  return out;
}
