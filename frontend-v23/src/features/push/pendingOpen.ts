/**
 * Aviso tocado sin sesión: su id (opaco) espera en ESTA pestaña hasta iniciar sesión.
 * sessionStorage: se borra al cerrar la app; nunca va al servidor más que en /target.
 */
const KEY = "etnara.push.pendingOpen";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function savePendingOpen(id: string): void {
  if (!UUID.test(id)) return;
  try { sessionStorage.setItem(KEY, id); } catch { /* sin almacenamiento: se abrirá la bandeja */ }
}
export function readPendingOpen(): string | null {
  try { const v = sessionStorage.getItem(KEY); return v && UUID.test(v) ? v : null; } catch { return null; }
}
export function clearPendingOpen(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* */ }
}
