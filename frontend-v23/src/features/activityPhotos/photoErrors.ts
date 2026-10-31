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
