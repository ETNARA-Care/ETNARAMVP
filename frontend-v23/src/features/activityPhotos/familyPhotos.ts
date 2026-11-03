import type { FamilyTimelineItem } from "@/api/familyTimeline";

/**
 * Fotos que la familia puede ver: solo las actividades cuyo `photo.reference`
 * envió el backend en ESTA respuesta (aprobada, consentimientos vigentes,
 * can_view_photos, interruptor encendido). La app no guarda nada: si la foto se
 * retira o cambia el consentimiento, la siguiente respuesta ya no la trae.
 */
export interface FamilyPhoto {
  id: string;
  itemId: string;
  title: string;
  summary: string;
  occurredAt: string;
  caregiverName: string | null;
  /** Hasta cuándo se puede ver (vencimiento provisional); null si el backend no lo envía. */
  availableUntil: string | null;
}

export function familyPhotos(items: readonly FamilyTimelineItem[]): FamilyPhoto[] {
  const out: FamilyPhoto[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const reference = item.photo?.visible ? item.photo.reference : undefined;
    if (!reference || seen.has(reference)) continue;
    seen.add(reference);
    out.push({ id: reference, itemId: item.id, title: item.title, summary: item.summary, occurredAt: item.occurredAt, caregiverName: item.caregiver?.displayName ?? null, availableUntil: item.photo?.availableUntil ?? null });
  }
  return out;
}

/** El visor sigue abierto solo si la foto sigue en la lista actual; si no, se cierra (retirada o consentimiento revocado). */
export function stillShared(photos: readonly FamilyPhoto[], id: string | null): boolean {
  return id !== null && photos.some((photo) => photo.id === id);
}

/** Siguiente/anterior, sin dar la vuelta. */
export function neighbour(photos: readonly FamilyPhoto[], id: string, step: 1 | -1): string | null {
  const index = photos.findIndex((photo) => photo.id === id);
  if (index < 0) return null;
  return photos[index + step]?.id ?? null;
}

/** Distancia entre dos dedos (pellizco). */
export function pinchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(value) ? value : MIN_ZOOM));
}
