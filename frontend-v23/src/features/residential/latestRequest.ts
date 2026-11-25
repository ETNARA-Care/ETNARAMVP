/**
 * 170 · revisión independiente 25-nov (A4). Datos de una pantalla ligados a la organización que los pidió:
 *   - cada carga recibe un turno; solo la última puede escribir el estado (una respuesta atrasada de la
 *     organización anterior se descarta);
 *   - lo que se muestra se filtra por la organización activa, así que al cambiar de organización nunca se ven,
 *     ni por un instante, los datos de la anterior.
 */
export interface OrganizationScoped<T> {
  organizationId: string;
  data: T | null;
  error: boolean;
}

export function createLatestRequest() {
  let turn = 0;
  return {
    /** Empieza una carga. `isCurrent()` deja de ser cierto en cuanto empieza otra o se invalida. */
    begin() { const mine = ++turn; return { isCurrent: () => mine === turn }; },
    /** Descarta cualquier carga en curso (cambio de organización o pantalla desmontada). */
    invalidate() { turn += 1; },
  };
}

/** El estado solo es visible si pertenece a la organización activa. */
export function scopedTo<T>(state: OrganizationScoped<T> | null, organizationId: string | null | undefined): OrganizationScoped<T> | null {
  return state && organizationId && state.organizationId === organizationId ? state : null;
}
