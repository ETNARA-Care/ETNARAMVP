/**
 * Estados de los documentos institucionales del establecimiento (ETNARA Verified voluntario, 1-nov-2026).
 *
 * Dos dimensiones que NO se mezclan:
 *  1. Estado del documento, que depende solo de la agencia y de la fecha:
 *     Faltante · Cargado · Próximo a vencer · Vencido.
 *     Un documento cargado nunca queda «pendiente» de nadie.
 *  2. Verificación de ETNARA, que es voluntaria y separada. Solo se muestra cuando existe:
 *     «Verificado por ETNARA» (aprobado) o «No verificado por ETNARA» (rechazado, con motivo).
 *     Si no hay verificación, no se muestra nada: no es un estado de espera.
 *
 * Sin imports: lo prueban directamente las pruebas de node (tests/etnara-verified-voluntario.test.mjs).
 */
export type EstablishmentDocumentStatus = "Faltante" | "Cargado" | "Próximo a vencer" | "Vencido";
export type StatusTone = "success" | "warning" | "danger" | "neutral";

export interface EstablishmentDocumentLike {
  expires_on: string | null;
  review_status?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
}

export interface EtnaraVerification {
  label: "Verificado por ETNARA" | "No verificado por ETNARA";
  tone: "success" | "danger";
  at: string | null;
  reason: string | null;
}

const DAY = 86_400_000;

export function documentStatus(doc: EstablishmentDocumentLike | undefined | null, now: Date = new Date()): EstablishmentDocumentStatus {
  if (!doc) return "Faltante";
  if (!doc.expires_on) return "Cargado";
  const end = new Date(`${doc.expires_on.slice(0, 10)}T23:59:59`);
  if (end < now) return "Vencido";
  if (end.getTime() - now.getTime() <= 30 * DAY) return "Próximo a vencer";
  return "Cargado";
}

export const STATUS_TONE: Record<EstablishmentDocumentStatus, StatusTone> = {
  Faltante: "neutral",
  Cargado: "success",
  "Próximo a vencer": "warning",
  Vencido: "danger",
};

/** Solo devuelve algo si ETNARA llegó a verificar ese documento; un documento sin verificación no está «pendiente». */
export function etnaraVerification(doc: EstablishmentDocumentLike | undefined | null): EtnaraVerification | null {
  if (!doc) return null;
  if (doc.review_status === "approved") return { label: "Verificado por ETNARA", tone: "success", at: doc.reviewed_at ?? null, reason: null };
  if (doc.review_status === "rejected") return { label: "No verificado por ETNARA", tone: "danger", at: doc.reviewed_at ?? null, reason: doc.review_reason ?? null };
  return null;
}

/** Texto para el historial: siempre explícito, también cuando no hubo verificación. */
export function verificationHistoryLabel(doc: EstablishmentDocumentLike): string {
  const v = etnaraVerification(doc);
  return v ? v.label : "Sin verificación de ETNARA";
}

export const AGENCY_DOCUMENTS_NOTICE =
  "Tu organización carga, consulta y reemplaza sus documentos institucionales. ETNARA no tiene acceso a ellos ni los valida automáticamente. La verificación de ETNARA (ETNARA Verified) es voluntaria y solo ocurre con tu autorización expresa.";
