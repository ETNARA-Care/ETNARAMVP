import type { ApiError } from "@/api/client";

/**
 * Errores de subida de fotos → clave del catálogo `photos` (es/en). Sin
 * dependencias en tiempo de ejecución: se prueba directamente con node --test.
 */
export type PhotoErrorKey =
  | "errors.offline" | "errors.consentRequired" | "errors.alreadyAttached" | "errors.tooLarge" | "errors.busy"
  | "errors.unavailable" | "errors.badImage" | "errors.notAllowed" | "errors.withCode" | "errors.generic";

/** Clave del catálogo `photos` para una subida fallida (la actividad ya está guardada). */
export function photoErrorKey(error: unknown): { key: PhotoErrorKey; code?: string } {
  const e = error as ApiError;
  if (e?.status === 0) return { key: "errors.offline" };
  if (e?.code === "PHOTO_CONSENT_REQUIRED") return { key: "errors.consentRequired" };
  if (e?.code === "PHOTO_ALREADY_ATTACHED") return { key: "errors.alreadyAttached" };
  if (e?.status === 413) return { key: "errors.tooLarge" };
  if (e?.code === "PHOTO_BUSY") return { key: "errors.busy" };
  if (e?.code === "PHOTO_STORAGE_NOT_CONFIGURED") return { key: "errors.unavailable" };
  if (e?.status === 415 || e?.status === 422) return { key: "errors.badImage" };
  if (e?.status === 404) return { key: "errors.notAllowed" };
  if (e?.errorId) return { key: "errors.withCode", code: e.errorId.slice(0, 8) };
  return { key: "errors.generic" };
}

/** Solo un fallo pasajero conserva la foto (en memoria) para «Reintentar foto». */
export function isRetryablePhotoError(error: unknown): boolean {
  const e = error as ApiError;
  return e?.status === 0 || e?.code === "PHOTO_BUSY" || e?.code === "PHOTO_STORAGE_NOT_CONFIGURED" || Boolean(e?.errorId);
}

export type AgencyPhotoErrorKey =
  | "agencyErrors.offline" | "agencyErrors.statusChanged" | "agencyErrors.reasonRequired" | "agencyErrors.consentRequired"
  | "agencyErrors.invalidTransition" | "agencyErrors.notAllowed" | "agencyErrors.notFound" | "agencyErrors.consentAlreadyActive"
  | "agencyErrors.formRequired" | "agencyErrors.formInvalid" | "agencyErrors.formTooLarge" | "agencyErrors.busy" | "agencyErrors.unavailable"
  | "agencyErrors.onHold" | "agencyErrors.onLegalHold" | "agencyErrors.holdLimit" | "agencyErrors.holdInvalid" | "agencyErrors.holdExists"
  | "agencyErrors.expired" | "agencyErrors.notShareable" | "agencyErrors.alreadyDeleted" | "agencyErrors.legalAdminOnly"
  | "agencyErrors.withCode" | "agencyErrors.generic";

/** Errores de la revisión y de los consentimientos (agencia) → clave del catálogo `photos`. */
export function agencyPhotoErrorKey(error: unknown): { key: AgencyPhotoErrorKey; code?: string } {
  const e = error as ApiError;
  if (e?.status === 0) return { key: "agencyErrors.offline" };
  switch (e?.code) {
    case "PHOTO_STATUS_CHANGED": return { key: "agencyErrors.statusChanged" };
    case "PHOTO_REASON_REQUIRED": case "PHOTO_CONSENT_REASON_REQUIRED": return { key: "agencyErrors.reasonRequired" };
    case "PHOTO_CONSENT_REQUIRED": return { key: "agencyErrors.consentRequired" };
    case "PHOTO_INVALID_TRANSITION": case "PHOTO_INVALID_DECISION": return { key: "agencyErrors.invalidTransition" };
    case "PHOTO_REVIEW_MANAGER_ONLY": case "PHOTO_CONSENT_MANAGER_ONLY": case "ORGANIZATION_ACCESS_DENIED": return { key: "agencyErrors.notAllowed" };
    case "PHOTO_CONSENT_ALREADY_ACTIVE": return { key: "agencyErrors.consentAlreadyActive" };
    case "PHOTO_CONSENT_FORM_REQUIRED": return { key: "agencyErrors.formRequired" };
    case "PHOTO_BUSY": return { key: "agencyErrors.busy" };
    case "PHOTO_STORAGE_NOT_CONFIGURED": return { key: "agencyErrors.unavailable" };
    // v2 (141–143)
    case "PHOTO_ON_HOLD": return { key: "agencyErrors.onHold" };
    case "PHOTO_ON_LEGAL_HOLD": return { key: "agencyErrors.onLegalHold" };
    case "PHOTO_HOLD_LIMIT": return { key: "agencyErrors.holdLimit" };
    case "PHOTO_HOLD_REASON_REQUIRED": case "PHOTO_HOLD_REVIEW_INVALID": case "PHOTO_LEGAL_HOLD_BASIS_REQUIRED": case "PHOTO_LEGAL_HOLD_REVIEW_INVALID": case "INVALID_PAYLOAD":
      return { key: "agencyErrors.holdInvalid" };
    case "PHOTO_HOLD_EXISTS": case "PHOTO_HOLD_NOT_ACTIVE": case "PHOTO_LEGAL_HOLD_EXISTS": case "PHOTO_LEGAL_HOLD_NOT_ACTIVE": return { key: "agencyErrors.holdExists" };
    case "PHOTO_EXPIRED": return { key: "agencyErrors.expired" };
    case "PHOTO_NOT_SHAREABLE": return { key: "agencyErrors.notShareable" };
    case "PHOTO_ALREADY_DELETED": case "PHOTO_DELETED_TERMINAL": return { key: "agencyErrors.alreadyDeleted" };
    case "PHOTO_LEGAL_HOLD_ADMIN_ONLY": return { key: "agencyErrors.legalAdminOnly" };
  }
  if (e?.status === 413) return { key: "agencyErrors.formTooLarge" };
  if (e?.status === 415 || e?.status === 422) return { key: "agencyErrors.formInvalid" };
  if (e?.status === 403) return { key: "agencyErrors.notAllowed" };
  if (e?.status === 404) return { key: "agencyErrors.notFound" };
  if (e?.errorId) return { key: "agencyErrors.withCode", code: e.errorId.slice(0, 8) };
  return { key: "agencyErrors.generic" };
}
