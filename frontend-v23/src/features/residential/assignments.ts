import type { BoardResident, Move } from "@/api/residentialAssignments";

/**
 * 176 (hogares F3): ayudas puras del portal. Solo anticipan lo que el backend volverá a comprobar (que es quien decide),
 * para pedir la confirmación y el motivo antes de enviar y no después.
 */

/** Hora local de Puerto Rico (UTC−4 todo el año, sin horario de verano) → ISO. Vacío → sin hora (el backend usa «ahora»). */
export function puertoRicoLocalToIso(local: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return undefined;
  return new Date(`${local}:00-04:00`).toISOString();
}

/** Residentes que quedarían sin nadie tras mover: los que solo atiende «from» y no van a otra persona. */
export function uncoveredAfterMoves(residents: readonly BoardResident[], moves: readonly Move[]): string[] {
  return residents.filter((r) => {
    const mine = moves.filter((m) => m.careRecipientId === r.id);
    if (mine.length === 0) return false;
    if (mine.some((m) => m.toMembershipId)) return false;
    const leaving = new Set(mine.map((m) => m.fromMembershipId));
    return r.coveredBy.every((id) => leaving.has(id));
  }).map((r) => r.id);
}

/** Sustitución: los residentes de la original que no se transfieren y que nadie más atiende quedan sin cobertura. */
export function uncoveredAfterSubstitution(
  residents: readonly BoardResident[], originalMembershipId: string, originalResidents: readonly string[], transfers: Readonly<Record<string, string | null>>,
): string[] {
  return originalResidents.filter((id) => {
    if (transfers[id]) return false;
    const r = residents.find((x) => x.id === id);
    return !r || r.coveredBy.every((m) => m === originalMembershipId);
  });
}

/** Transferencias por defecto: todo a la sustituta (total). El administrador puede cambiar cada residente (selectiva). */
export function defaultTransfers(originalResidents: readonly string[], substituteMembershipId: string): Record<string, string | null> {
  return Object.fromEntries(originalResidents.map((id) => [id, substituteMembershipId]));
}

export function transfersBody(transfers: Readonly<Record<string, string | null>>): Array<{ careRecipientId: string; toMembershipId: string }> {
  return Object.entries(transfers).filter((e): e is [string, string] => !!e[1]).map(([careRecipientId, toMembershipId]) => ({ careRecipientId, toMembershipId }));
}
