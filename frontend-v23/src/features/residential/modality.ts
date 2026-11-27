/**
 * 170 (hogares F0): modalidad «Hogar de envejecientes» (RESIDENTIAL_CARE_HOME). Puro: decide qué ve el portal.
 * El backend (170) cierra igualmente esas rutas con 403 MODALITY_NOT_AVAILABLE: ocultar aquí es comodidad, no la barrera.
 * Agencias e independientes no pasan por aquí con ningún efecto.
 */
export const RESIDENTIAL_CARE_HOME = "RESIDENTIAL_CARE_HOME";

export function isResidentialOrganization(organization: { type?: string | null } | null | undefined): boolean {
  return organization?.type === RESIDENTIAL_CARE_HOME;
}

/** Módulos que no existen para un hogar (plan §2 y D10): SmartMatch, Finanzas y Facturación, Informe de Turno. */
export const RESIDENTIAL_HIDDEN_AGENCY_PATHS = [
  "/agency/smartmatch",
  "/agency/finance",       // Finanzas y Facturación
  "/agency/shift-reports", // Informe de Turno (D10)
] as const;

export function isHiddenForResidential(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  return RESIDENTIAL_HIDDEN_AGENCY_PATHS.some((hidden) => path === hidden || path.startsWith(`${hidden}/`));
}

/** Panel base del hogar (solo hogares). */
export const RESIDENTIAL_PANEL_PATH = "/agency/hogar";
/** 171 (F1): establecimientos, unidades, habitaciones y ubicación de residentes (solo hogares). */
export const RESIDENTIAL_ESTABLISHMENTS_PATH = "/agency/hogar/establecimientos";

/** D9: franja visible solo cuando ETNARA central encendió DEMO_ENVIRONMENT para esa organización. */
export const DEMO_ENVIRONMENT_NOTICE = "Entorno de demostración — Datos ficticios";
export function isDemoEnvironment(features: readonly string[] | undefined | null): boolean {
  return Array.isArray(features) && features.includes("DEMO_ENVIRONMENT");
}

/** 171: mensaje cuando se intenta archivar un establecimiento de hogar por la vía ordinaria (Configuración). Texto en el catálogo «residential». */
export const RESIDENTIAL_CLOSURE_REQUIRED_MESSAGE_KEY = "residential:establishments.settings.closureRequired";
