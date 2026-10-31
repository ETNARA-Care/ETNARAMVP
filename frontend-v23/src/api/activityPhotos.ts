import { apiClient, type ApiError } from "./client";

/**
 * Fotos de actividades (backend 115/116, detrás de ACTIVITY_PHOTOS).
 *
 * - La cuidadora solo sabe «¿puedo añadir una foto aquí?»: nunca nada del consentimiento.
 * - Las imágenes llegan como Blob privado (token en la cabecera, sin caché) y se muestran
 *   con URL de objeto; ninguna URL del bucket ni clave de almacenamiento llega a la app.
 * - Nada se guarda en el teléfono: ni la foto ni su vista previa (las fotos sin conexión son E6).
 */
export type ActivityPhotoStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ActivityPhotoRef {
  id: string;
  status: ActivityPhotoStatus;
}

const notFound = (error: unknown) => (error as ApiError)?.status === 404;

/** Antes de registrar: ¿puede esta cuidadora añadir una foto en este turno? 404 = no. */
export async function getShiftPhotoEligibility(organizationId: string, shiftId: string, token: string): Promise<boolean> {
  try {
    const result = await apiClient.get<{ canAttach: boolean }>(`/organizations/${organizationId}/shifts/${shiftId}/photo-eligibility`, token);
    return result.canAttach === true;
  } catch (error) {
    if (notFound(error)) return false;
    throw error;
  }
}

/** Para una actividad ya guardada (reintento): ¿todavía se puede añadir la foto? 404 = no. */
export async function getActivityPhotoEligibility(organizationId: string, careEventId: string, token: string): Promise<boolean> {
  try {
    const result = await apiClient.get<{ canAttach: boolean }>(`/organizations/${organizationId}/care-events/${careEventId}/photo-eligibility`, token);
    return result.canAttach === true;
  } catch (error) {
    if (notFound(error)) return false;
    throw error;
  }
}

/** Sube UNA foto de la actividad. El servidor repite todas las comprobaciones y quita los metadatos. */
export async function uploadActivityPhoto(organizationId: string, careEventId: string, photo: Blob, contentType: string, token: string): Promise<ActivityPhotoRef> {
  const result = await apiClient.postBinary<{ photo: ActivityPhotoRef }>(
    `/organizations/${organizationId}/care-events/${careEventId}/photo`, photo, contentType, token);
  return result.photo;
}

/** La foto de una de sus actividades, o null. */
export async function getActivityPhoto(organizationId: string, careEventId: string, token: string): Promise<ActivityPhotoRef | null> {
  try {
    const result = await apiClient.get<{ photo: ActivityPhotoRef | null }>(`/organizations/${organizationId}/care-events/${careEventId}/photo`, token);
    return result.photo ?? null;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/** La imagen como Blob privado (cabecera Authorization, cache: no-store). */
export function getActivityPhotoImage(organizationId: string, photoId: string, token: string): Promise<Blob> {
  return apiClient.getBinary(`/organizations/${organizationId}/activity-photos/${photoId}/image`, token);
}
