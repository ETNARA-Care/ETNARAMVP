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

// ------------------------------------------------------------------ agencia (E2)
// Solo administración y supervisión (el backend responde 403 a los demás y 404 con el interruptor apagado).

export interface AgencyPhoto {
  id: string;
  careEventId: string;
  careRecipientId: string;
  careRecipientName: string;
  status: ActivityPhotoStatus;
  uploadedAt: string;
  reviewedAt: string | null;
  reviewReason: string | null;
  activity: { type: string; occurredAt: string; note: string | null };
  caregiverName: string | null;
}

export type PhotoDecision = "APPROVE" | "REJECT" | "WITHDRAW";

export interface PhotoHistoryEntry {
  action: "UPLOADED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  from: ActivityPhotoStatus | null;
  to: ActivityPhotoStatus;
  reason: string | null;
  at: string;
  actor: string | null;
}

export type PhotoConsentType = "PHOTO_CAPTURE" | "PHOTO_SHARE_FAMILY";
export type PhotoConsentSigner = "PATIENT" | "LEGAL_REPRESENTATIVE";

export interface PhotoConsent {
  id: string;
  type: PhotoConsentType;
  version: number;
  signerRole: PhotoConsentSigner;
  grantedAt: string;
  grantedBy: string | null;
  active: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
}

/** Bandeja de la agencia, la más reciente primero (máx. 100 por página en el backend). */
export async function listAgencyPhotos(organizationId: string, token: string, filter: { status?: ActivityPhotoStatus; careRecipientId?: string; limit?: number } = {}): Promise<AgencyPhoto[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  if (filter.careRecipientId) params.set("careRecipientId", filter.careRecipientId);
  if (filter.limit) params.set("limit", String(filter.limit));
  const query = params.toString();
  const result = await apiClient.get<{ photos: AgencyPhoto[] }>(`/organizations/${organizationId}/activity-photos${query ? `?${query}` : ""}`, token);
  return result.photos;
}

export async function getAgencyPhotoHistory(organizationId: string, photoId: string, token: string): Promise<PhotoHistoryEntry[]> {
  const result = await apiClient.get<{ history: PhotoHistoryEntry[] }>(`/organizations/${organizationId}/activity-photos/${photoId}/history`, token);
  return result.history;
}

/** Decisión con concurrencia optimista: expectedStatus es el estado que la persona estaba viendo (409 PHOTO_STATUS_CHANGED si cambió). */
export async function reviewAgencyPhoto(organizationId: string, photoId: string, decision: PhotoDecision, expectedStatus: ActivityPhotoStatus, token: string, reason?: string): Promise<{ id: string; status: ActivityPhotoStatus }> {
  const result = await apiClient.post<{ photo: { id: string; status: ActivityPhotoStatus } }>(
    `/organizations/${organizationId}/activity-photos/${photoId}/review`, { decision, expectedStatus, ...(reason?.trim() ? { reason: reason.trim() } : {}) }, token);
  return result.photo;
}

export async function listPhotoConsents(organizationId: string, careRecipientId: string, token: string): Promise<PhotoConsent[]> {
  const result = await apiClient.get<{ consents: PhotoConsent[] }>(`/organizations/${organizationId}/care-recipients/${careRecipientId}/photo-consents`, token);
  return result.consents;
}

/** Registra un consentimiento con su formulario firmado (PDF o foto). Nunca edita uno anterior. */
export async function recordPhotoConsent(organizationId: string, careRecipientId: string, type: PhotoConsentType, signerRole: PhotoConsentSigner, form: Blob, contentType: string, token: string): Promise<{ id: string; type: PhotoConsentType; active: boolean }> {
  const params = new URLSearchParams({ type, signerRole });
  const result = await apiClient.postBinary<{ consent: { id: string; type: PhotoConsentType; active: boolean } }>(
    `/organizations/${organizationId}/care-recipients/${careRecipientId}/photo-consents?${params.toString()}`, form, contentType, token);
  return result.consent;
}

export async function revokePhotoConsent(organizationId: string, consentId: string, reason: string, token: string): Promise<void> {
  await apiClient.post(`/organizations/${organizationId}/photo-consents/${consentId}/revoke`, { reason: reason.trim() }, token);
}

/** El formulario firmado como Blob privado (PDF o imagen). */
export function getPhotoConsentForm(organizationId: string, consentId: string, token: string): Promise<Blob> {
  return apiClient.getBinary(`/organizations/${organizationId}/photo-consents/${consentId}/form`, token);
}
