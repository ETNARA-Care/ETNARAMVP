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

/** Condiciones de una Orden de Suscripción en lenguaje claro (153). Todo es propuesta; solo informativo. */
type OrderTermsView = {
  planName?: string; features?: string[]; limits?: string | null; pricing?: { proposedMonthlyPriceUsd: number | null };
  promotions?: Array<{ description: string; durationDays: number | null }>; addOns?: Array<{ name: string; proposedMonthlyPriceUsd: number | null }>;
  conditions?: string[]; foundingProgram?: { proposedBenefits: string[] } | null; chargesRequireExpressAcceptance?: boolean; billingActivated?: boolean;
};
const money = (x: number) => `US$${x.toFixed(2)}`;
export function orderTermsLines(t: OrderTermsView): string[] {
  const out: string[] = [];
  if (t.planName) out.push(`Plan propuesto: ${t.planName}.`);
  if (t.features?.length) out.push(`Funcionalidades: ${t.features.join(", ")}.`);
  if (t.limits) out.push(`Límites: ${t.limits}`);
  if (t.pricing) out.push(t.pricing.proposedMonthlyPriceUsd === null ? "Precio mensual: por definir y aceptar." : `Precio mensual propuesto: ${money(t.pricing.proposedMonthlyPriceUsd)} (sujeto a aprobación y a tu aceptación expresa).`);
  for (const p of t.promotions ?? []) out.push(`Promoción: ${p.description}${p.durationDays ? ` (${p.durationDays} días)` : ""}.`);
  for (const a of t.addOns ?? []) out.push(`Complemento opcional: ${a.name} — ${a.proposedMonthlyPriceUsd === null ? "precio por definir" : `${money(a.proposedMonthlyPriceUsd)} al mes (propuesta)`}.`);
  for (const c of t.conditions ?? []) out.push(`Condición: ${c}`);
  if (t.foundingProgram) out.push("Programa Agencias Fundadoras: incluido como propuesta pendiente de aprobación definitiva.");
  if (t.chargesRequireExpressAcceptance) out.push("Ningún cargo ni renovación sin tu aceptación expresa.");
  if (t.billingActivated === false) out.push("La facturación no está activada.");
  return out;
}
