/**
 * Actualización del Portal Familiar (fotos E3, mejora de revocación).
 *
 * - Con el visor de fotos abierto y la app visible: cada 10 s. Si la agencia
 *   retiró la foto o cambió el consentimiento, el visor se cierra en ≤ 10 s
 *   (el servidor ya la niega desde el primer instante).
 * - Sin visor: cada 30 s, como antes.
 * - App oculta (otra app, pantalla apagada): no se pide nada.
 * - Al volver a la app (`visibilitychange` o `focus`): se actualiza en seguida,
 *   una sola vez aunque lleguen los dos eventos juntos.
 * Solo se vuelve a pedir la línea de tiempo (unos KB), nunca la imagen.
 */
export const VIEWER_REFRESH_MS = 10_000;
export const PAGE_REFRESH_MS = 30_000;
/** Dos eventos de vuelta casi simultáneos (focus + visibilitychange) cuentan como uno. */
export const RETURN_DEDUPE_MS = 2_000;

export function refreshInterval(viewerOpen: boolean): number {
  return viewerOpen ? VIEWER_REFRESH_MS : PAGE_REFRESH_MS;
}

/** ¿Toca actualizar al volver a la app? (no si se acaba de hacer). */
export function shouldRefreshOnReturn(lastLoadAt: number, now: number): boolean {
  return now - lastLoadAt >= RETURN_DEDUPE_MS;
}

/** Solicitudes por minuto con la app visible: 2 sin visor, 6 con el visor abierto. */
export function requestsPerMinute(viewerOpen: boolean): number {
  return 60_000 / refreshInterval(viewerOpen);
}

// ---- ¿Hay un visor de fotos abierto en esta pestaña? (lo marca el propio visor)
let openViewers = 0;
const listeners = new Set<() => void>();
export function markViewerOpen(): () => void {
  openViewers += 1;
  listeners.forEach((listener) => listener());
  return () => {
    openViewers = Math.max(0, openViewers - 1);
    listeners.forEach((listener) => listener());
  };
}
export function subscribeViewer(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function isViewerOpen(): boolean {
  return openViewers > 0;
}
