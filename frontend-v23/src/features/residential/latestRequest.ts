/**
 * 170 · revisión independiente 25-nov (A4). Datos de una pantalla ligados a la organización que los pidió:
 *   - cada carga recibe un turno; solo la última puede escribir el estado (una respuesta atrasada de la
 *     organización anterior se descarta);
 *   - lo que se muestra se filtra por la organización activa, así que al cambiar de organización nunca se ven,
 *     ni por un instante, los datos de la anterior.
 */
export interface OrganizationScoped<T> {
  organizationId: string;
  /** 171: además de la organización, lo que identifica la pantalla (p. ej. el establecimiento). */
  key?: string;
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

/** El estado solo es visible si pertenece a la organización activa (y, si se indica, a la misma pantalla). */
export function scopedTo<T>(state: OrganizationScoped<T> | null, organizationId: string | null | undefined, key?: string): OrganizationScoped<T> | null {
  return state && organizationId && state.organizationId === organizationId && (key === undefined || state.key === key) ? state : null;
}

/**
 * 171 · auditoría 26-nov. Un valor de pantalla (p. ej. un diálogo abierto con su formulario) ligado a la organización
 * Y al establecimiento en que se abrió: si cambia cualquiera de los dos deja de existir, así que nunca se conserva un
 * formulario anterior ni se ejecuta una operación sobre el establecimiento equivocado.
 */
export interface ScreenScoped<T> {
  organizationId: string;
  key: string;
  value: T;
}

export function scopedValue<T>(scoped: ScreenScoped<T> | null, organizationId: string | null | undefined, key: string | null | undefined): T | null {
  return scoped && organizationId && key && scoped.organizationId === organizationId && scoped.key === key ? scoped.value : null;
}
