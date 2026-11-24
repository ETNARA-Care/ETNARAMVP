/**
 * 160 (PR B, «Mi práctica»): modalidad «Cuidador independiente». Una sola persona administra su práctica y presta
 * el servicio (ORGANIZATION_ADMIN + WORKER). Este módulo es puro: decide qué ve el portal. El backend (160) cierra
 * igualmente esas rutas con 403 MODALITY_NOT_AVAILABLE: ocultar aquí es comodidad, no la barrera.
 */
export const INDEPENDENT_PROVIDER = "INDEPENDENT_PROVIDER";

export function isIndependentOrganization(organization: { type?: string | null } | null | undefined): boolean {
  return organization?.type === INDEPENDENT_PROVIDER;
}

/**
 * Secciones del portal administrativo que solo existen en agencias y hogares. Se corresponden con las rutas que el
 * backend cierra para un independiente (modalityRules) o con funciones de supervisión de terceros que una sola
 * persona no necesita (revisar sus propios informes, fotos o horas; eso se decide en el PR C).
 */
export const INDEPENDENT_HIDDEN_AGENCY_PATHS = [
  "/agency/workers",       // personal y fichas
  "/agency/compliance",    // centro de cumplimiento del personal (sus documentos propios llegan en el PR C)
  "/agency/smartmatch",
  "/agency/planning",
  "/agency/timesheets",    // aprobación de horas
  "/agency/finance",       // tarifas del personal y facturación de agencia (pendiente de decisión para independientes)
  "/agency/operations",    // centro operacional y su historial
  "/agency/agents",
  "/agency/quality",       // agente de calidad del cuidado
  "/agency/shift-reports", // cola de revisión de informes (en el PR C publica «Informe del proveedor»)
  "/agency/photos",        // revisión de fotos por supervisión
  "/agency/settings/establishments",
] as const;

export function isHiddenForIndependent(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  return INDEPENDENT_HIDDEN_AGENCY_PATHS.some((hidden) => path === hidden || path.startsWith(`${hidden}/`));
}
