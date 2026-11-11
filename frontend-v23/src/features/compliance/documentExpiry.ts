/**
 * Vencimiento de documentos institucionales (D4, 5-nov-2026).
 *
 * Tres situaciones distintas, que el portal nunca confunde (backend: migración 150, campo
 * expiry_status explícito; sin fechas artificiales):
 *   - fecha informada → Vencido / Próximo a vencer (30 días) / al día;
 *   - «Sin vencimiento aplicable»: el documento no vence;
 *   - «Vencimiento no informado»: la agencia aún no registró la fecha. NO cuenta como al día:
 *     se muestra como asunto pendiente hasta que la agencia la informe.
 */
export const NO_EXPIRY_INPUT = "none";
export const EXPIRING_SOON_DAYS = 30;
export const EXPIRY_NOT_INFORMED_LABEL = "Vencimiento no informado";
export const NO_EXPIRY_LABEL = "Sin vencimiento aplicable";

export type ExpiryState = "not_informed" | "no_expiry" | "expired" | "expiring" | "current";
/** Lo mínimo de un documento para conocer su vencimiento (lo que devuelve el backend). */
export interface ExpiryFields { expires_on: string | null; expiry_status?: "date" | "not_applicable" | "not_informed"; expiry_not_applicable?: boolean }

/** El documento vence al terminar el día indicado (hora local). */
export function expiryState(doc: ExpiryFields, now = new Date()): ExpiryState {
  if (doc.expiry_status === "not_applicable" || doc.expiry_not_applicable) return "no_expiry";
  const expiresOn = doc.expires_on;
  if (!expiresOn) return "not_informed";
  const end = new Date(`${expiresOn.slice(0, 10)}T23:59:59`);
  if (end < now) return "expired";
  if (end.getTime() - now.getTime() <= EXPIRING_SOON_DAYS * 86400000) return "expiring";
  return "current";
}

/** «15 ene 2027». */
export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric" });
}

/** Texto del vencimiento para una línea de estado. */
export function expiryText(doc: ExpiryFields, now = new Date()): string {
  const state = expiryState(doc, now);
  if (state === "not_informed") return EXPIRY_NOT_INFORMED_LABEL;
  if (state === "no_expiry") return NO_EXPIRY_LABEL;
  return `${state === "expired" ? "Venció" : "Vence"} ${formatDocumentDate(doc.expires_on)}`;
}

export type ExpiryChoice = "date" | "none" | "unknown";

/** Hoy (YYYY-MM-DD) en la zona del dispositivo; las agencias trabajan en Puerto Rico. */
export function todayYmd(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Valida en el portal lo mismo que el backend (que vuelve a validar).
 * Devuelve un mensaje para la persona o null si está bien.
 */
export function validateDocumentDates(issuedOn: string, choice: ExpiryChoice, expiresOn: string, now = new Date()): string | null {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (issuedOn && !ymd.test(issuedOn)) return "La fecha de emisión no es válida.";
  if (issuedOn && issuedOn > todayYmd(now)) return "La fecha de emisión no puede ser futura.";
  if (choice === "date") {
    if (!expiresOn) return "Indica la fecha de vencimiento o elige otra opción.";
    if (!ymd.test(expiresOn)) return "La fecha de vencimiento no es válida.";
    if (issuedOn && expiresOn < issuedOn) return "El vencimiento no puede ser anterior a la emisión.";
  }
  return null;
}

/** Valor que se envía al backend para el vencimiento. */
export function expiresOnPayload(choice: ExpiryChoice, expiresOn: string): string | null {
  return choice === "none" ? NO_EXPIRY_INPUT : choice === "date" ? expiresOn : null;
}

/** Opción inicial a partir de lo guardado. */
export function expiryChoiceOf(doc: ExpiryFields): ExpiryChoice {
  const state = expiryState(doc);
  return state === "not_informed" ? "unknown" : state === "no_expiry" ? "none" : "date";
}
