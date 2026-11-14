import { apiClient, type ApiError } from "./client";

/**
 * Fotos de actividades (backend 115/116, detrás de ACTIVITY_PHOTOS).
 *
 * - El cuidador solo sabe «¿puedo añadir una foto aquí?»: nunca nada del consentimiento.
 * - Las imágenes llegan como Blob privado (token en la cabecera, sin caché) y se muestran
 *   con URL de objeto; ninguna URL del bucket ni clave de almacenamiento llega a la app.
 * - Nada se guarda en el teléfono: ni la foto ni su vista previa (las fotos sin conexión son E6).
 */
/**
 * v2 (backend 141–143): sin aprobación manual.
 * - approved = compartida al enviarse (consentimiento de compartir vigente) con los familiares que la autorizaron;
 * - pending = solo para la agencia (no había consentimiento de compartir al enviarla);
 * - withdrawn / rejected = retirada por la agencia; deleted = eliminada (queda una lápida sin imagen).
 */
export type ActivityPhotoStatus = "pending" | "approved" | "rejected" | "withdrawn" | "deleted";

export interface ActivityPhotoRef {
  id: string;
  status: ActivityPhotoStatus;
  /** Al enviarla: ¿se compartió con la familia autorizada? Nunca dice quién ni cuántos. */
  sharedWithFamily?: boolean;
  /** Fin del plazo de conservación (provisional). */
  availableUntil?: string;
  /** El cuidador puede quitarla (solo durante su visita). */
  canRemove?: boolean;
  /** D1: la agencia la conserva (retención vigente u obligación legal): no se puede quitar. Nunca el motivo. */
  keptByAgency?: boolean;
}

const notFound = (error: unknown) => (error as ApiError)?.status === 404;

/** Antes de registrar: ¿puede este cuidador añadir una foto en este turno? 404 = no. */
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

/** Quitar/eliminar una foto. El cuidador solo durante su visita (sin motivo); la agencia con motivo. Es definitivo. */
export async function deleteActivityPhoto(organizationId: string, photoId: string, token: string, reason?: string): Promise<{ kind: string; purged: boolean }> {
  const result = await apiClient.post<{ photo: { kind: string; purged: boolean } }>(
    `/organizations/${organizationId}/activity-photos/${photoId}/delete`, reason?.trim() ? { reason: reason.trim() } : {}, token);
  return result.photo;
}

/** La imagen como Blob privado (cabecera Authorization, cache: no-store). */
/**
 * `legalReview`: 145 (§5) con el módulo apagado, el backend solo entrega una imagen retenida si la
 * petición declara este propósito (solo lo envía «Ver imagen» del modo de revisión legal).
 */
export function getActivityPhotoImage(organizationId: string, photoId: string, token: string, opts: { legalReview?: boolean } = {}): Promise<Blob> {
  return apiClient.getBinary(`/organizations/${organizationId}/activity-photos/${photoId}/image${opts.legalReview ? "?purpose=legal-review" : ""}`, token);
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
  sharedAt: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  activity: { type: string; occurredAt: string; note: string | null };
  caregiverName: string | null;
  availableUntil: string;
  expired: boolean;
  /** La agencia puede ver la imagen (no eliminada; no vencida o bajo retención). */
  viewable: boolean;
  deletion: { at: string; kind: "MANUAL" | "CAREGIVER_UNDO" | "RETENTION" | "RECONCILED"; reason: string | null; purgeVerified: boolean } | null;
  hold: { active: boolean; reason: string; reviewAt: string; by: string | null; actionsUsed: number; actionsMax: number } | null;
  /** 145 (§6): basis, reference and author only reach the administration (absent for supervision). */
  legalHold: { basis?: string | null; reference?: string | null; placedAt: string; reviewAt: string; reviewOverdue: boolean; by?: string | null } | null;
}

/** v2: sin aprobación manual. WITHDRAW = retirar (motivo); APPROVE = volver a mostrar una foto retirada. */
export type PhotoDecision = "APPROVE" | "WITHDRAW";

export interface PhotoHistoryEntry {
  action: "UPLOADED" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "SHARED" | "RESHOWN" | "DELETED" | "PURGED"
    | "HOLD_PLACED" | "HOLD_RENEWED" | "HOLD_RELEASED" | "HOLD_EXPIRED" | "LEGAL_HOLD_PLACED" | "LEGAL_HOLD_REVIEWED" | "LEGAL_HOLD_RELEASED";
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
export async function listAgencyPhotos(organizationId: string, token: string,
  filter: { status?: ActivityPhotoStatus; careRecipientId?: string; legalReview?: "overdue" | "active"; limit?: number } = {}): Promise<AgencyPhoto[]> {
  const params = new URLSearchParams();
  if (filter.status) params.set("status", filter.status);
  // 144 (D2): retenciones legales con la revisión vencida, en cualquier estado.
  if (filter.legalReview) params.set("legalReview", filter.legalReview);
  if (filter.careRecipientId) params.set("careRecipientId", filter.careRecipientId);
  if (filter.limit) params.set("limit", String(filter.limit));
  const query = params.toString();
  const result = await apiClient.get<{ photos: AgencyPhoto[] }>(`/organizations/${organizationId}/activity-photos${query ? `?${query}` : ""}`, token);
  return result.photos;
}

/**
 * 145 (§5): qué pantalla de fotos corresponde aquí. "full" (módulo encendido, administración o
 * supervisión), "legal-review" (módulo apagado, administración, hay retenciones legales: solo
 * revisarlas o levantarlas) u "off". El backend decide; el portal solo lo muestra.
 */
export type AgencyPhotoMode = "full" | "legal-review" | "off";
export async function getAgencyPhotoMode(organizationId: string, token: string): Promise<AgencyPhotoMode> {
  const r = await apiClient.get<{ mode: AgencyPhotoMode }>(`/organizations/${encodeURIComponent(organizationId)}/activity-photos/mode`, token);
  return r.mode === "full" || r.mode === "legal-review" ? r.mode : "off";
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

// ------------------------------------------------------------------ v2: retenciones (agencia)
/** Retención excepcional: administración o supervisión; motivo (10+), revisión ≤ 90 días, máx. 3 acciones y 270 días. */
export async function holdAgencyPhoto(organizationId: string, photoId: string, token: string,
  input: { action: "PLACE" | "RENEW"; reason: string; reviewAt: string } | { action: "RELEASE"; reason: string }): Promise<void> {
  await apiClient.post(`/organizations/${organizationId}/activity-photos/${photoId}/hold`, input, token);
}

/** Retención legal (obligación vigente): solo administración; sin límite; nunca caduca; bloquea toda eliminación. */
export async function legalHoldAgencyPhoto(organizationId: string, photoId: string, token: string,
  input: { action: "PLACE" | "REVIEW"; basis: string; reference?: string; reviewAt: string } | { action: "RELEASE"; basis: string }): Promise<void> {
  await apiClient.post(`/organizations/${organizationId}/activity-photos/${photoId}/legal-hold`, input, token);
}

export interface PhotoRecipient {
  relationshipId: string;
  email: string;
  relationshipType: string;
  receipt: "not_answered" | "accepted" | "declined";
  decidedAt: string | null;
  allowedByAgency: boolean;
  receives: boolean;
}

/** Agencia: qué familiares de este residente reciben fotos (cada uno lo decide). */
export async function listPhotoRecipients(organizationId: string, careRecipientId: string, token: string): Promise<PhotoRecipient[]> {
  const result = await apiClient.get<{ recipients: PhotoRecipient[] }>(`/organizations/${organizationId}/care-recipients/${careRecipientId}/photo-recipients`, token);
  return result.recipients;
}

// ------------------------------------------------------------------ v2: autorización del familiar (la suya)
export type PhotoReceiptDecision = "not_answered" | "accepted" | "declined";
export interface PhotoReceipt { decision: PhotoReceiptDecision; decidedAt: string | null; textVersion: string | null }

/** Versión del texto de autorización que se muestra (queda registrada con la decisión). */
export const PHOTO_RECEIPT_TEXT_VERSION = "autorizacion-familia-v1";

export async function getPhotoReceipt(organizationId: string, careRecipientId: string, token: string): Promise<PhotoReceipt | null> {
  try {
    const result = await apiClient.get<{ receipt: PhotoReceipt }>(`/organizations/${organizationId}/care-recipients/${careRecipientId}/photo-receipt`, token);
    return result.receipt;
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

/** Solo afecta a las fotos enviadas DESPUÉS de este momento (nunca a las anteriores). */
export async function setPhotoReceipt(organizationId: string, careRecipientId: string, decision: "accepted" | "declined", token: string): Promise<PhotoReceipt> {
  const result = await apiClient.put<{ receipt: PhotoReceipt }>(`/organizations/${organizationId}/care-recipients/${careRecipientId}/photo-receipt`,
    { decision, textVersion: PHOTO_RECEIPT_TEXT_VERSION }, token);
  return result.receipt;
}
