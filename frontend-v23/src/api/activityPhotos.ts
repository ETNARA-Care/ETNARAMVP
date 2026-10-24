import { apiClient, type ApiError } from "./client";

/**
 * Activity photos (backend #208, behind ACTIVITY_PHOTOS). The caregiver only
 * learns "can I attach a photo here?" — never anything about the consent.
 * Images are fetched as private Blobs (token in the header, no cache) and
 * shown through object URLs; no bucket URL or storage key ever reaches the app.
 */
export type ActivityPhotoStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ActivityPhotoRef {
  id: string;
  status: ActivityPhotoStatus;
}

const notFound = (error: unknown) => (error as ApiError)?.status === 404;

/** Before recording an activity: may this caregiver attach a photo on this shift? 404 = no. */
export async function getShiftPhotoEligibility(organizationId: string, shiftId: string, token: string): Promise<boolean> {
  try {
    const result = await apiClient.get<{ canAttach: boolean }>(`/organizations/${organizationId}/shifts/${shiftId}/photo-eligibility`, token);
    return result.canAttach === true;
  } catch (error) {
    if (notFound(error)) return false;
    throw error;
  }
}

/** For an activity already saved (retry): may a photo still be attached? 404 = no. */
export async function getActivityPhotoEligibility(organizationId: string, careEventId: string, token: string): Promise<boolean> {
  try {
    const result = await apiClient.get<{ canAttach: boolean }>(`/organizations/${organizationId}/care-events/${careEventId}/photo-eligibility`, token);
    return result.canAttach === true;
  } catch (error) {
    if (notFound(error)) return false;
    throw error;
  }
}

/** Uploads ONE photo for the activity. The server repeats every check and removes all metadata. */
export async function uploadActivityPhoto(organizationId: string, careEventId: string, photo: Blob, contentType: string, token: string): Promise<ActivityPhotoRef> {
  const result = await apiClient.postBinary<{ photo: ActivityPhotoRef }>(
    `/organizations/${organizationId}/care-events/${careEventId}/photo`, photo, contentType, token);
  return result.photo;
}

/** The photo attached to one of her activities, or null. */
export async function getActivityPhoto(organizationId: string, careEventId: string, token: string): Promise<ActivityPhotoRef | null> {
  try {
    const result = await apiClient.get<{ photo: ActivityPhotoRef }>(`/organizations/${organizationId}/care-events/${careEventId}/photo`, token);
    return result.photo ?? null;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

export function getActivityPhotoImage(organizationId: string, photoId: string, token: string): Promise<Blob> {
  return apiClient.getBlob(`/organizations/${organizationId}/activity-photos/${photoId}/image`, token);
}

export const PHOTO_STATUS_LABEL: Record<ActivityPhotoStatus, string> = {
  pending: "En revisión",
  approved: "Compartida con la familia",
  rejected: "No compartida",
  withdrawn: "Retirada",
};

/** Plain message for a failed photo upload (the activity itself is already saved). */
export function photoErrorMessage(error: unknown): string {
  const e = error as ApiError;
  if (e?.status === 0) return "No hay conexión. La foto no se envió.";
  if (e?.code === "PHOTO_CONSENT_REQUIRED") return "Esta persona ya no tiene consentimiento de fotografía. La actividad se guardó sin foto.";
  if (e?.code === "PHOTO_ALREADY_ATTACHED") return "Esta actividad ya tiene una foto.";
  if (e?.status === 413) return "La foto es demasiado grande.";
  if (e?.code === "PHOTO_BUSY") return "El servidor está ocupado. Reintenta en unos segundos.";
  if (e?.code === "PHOTO_STORAGE_NOT_CONFIGURED") return "Las fotos no están disponibles ahora.";
  if (e?.status === 415 || e?.status === 422) return "No se pudo usar esa imagen. Prueba con otra foto.";
  if (e?.status === 404) return "Las fotos no están disponibles para este registro.";
  if (e?.errorId) return `No se pudo enviar la foto. Código: ${e.errorId.slice(0, 8)}`;
  return "No se pudo enviar la foto.";
}
