/**
 * Catálogo documental único del portal (Fase 1 de «cumplimiento por modalidad», 4-nov-2026).
 *
 * Antes las mismas listas estaban copiadas en cuatro archivos. Ahora viven solo aquí.
 *
 * Reglas de la Fase 1 (solo portal, sin cambios en la base de datos):
 * - Las listas de documentos de establecimiento y de expediente de residente son las de un
 *   HOGAR RESIDENCIAL y se aplican únicamente a los establecimientos (los residentes con
 *   expediente siempre pertenecen a un establecimiento). Los hogares conservan exactamente sus
 *   requisitos actuales.
 * - Una agencia de cuido domiciliario sin establecimientos no ve paneles, alertas ni llamadas a
 *   "añadir establecimiento" propias de un hogar residencial.
 * - ETNARA organiza documentos y avisa de faltantes y vencimientos; NO certifica el cumplimiento
 *   legal. Cada organización es responsable de sus obligaciones.
 * - Nada de esto bloquea operaciones (igual que antes). El único bloqueo sigue siendo la
 *   elegibilidad del personal, calculada por el backend con la política de cada agencia.
 *
 * Fase 2 sustituirá estas listas por la configuración de cada organización y la modalidad de
 * cada establecimiento; los nombres se conservan para que los documentos ya cargados coincidan.
 */

export type CareModality = "home_care" | "residential" | "other";

/** Modalidad de la organización a partir del tipo que ya devuelve /me (organization_type). */
export function organizationModality(type: string | null | undefined): CareModality {
  if (type === "RESIDENTIAL_CARE_HOME") return "residential";
  if (type === "HOME_CARE_AGENCY") return "home_care";
  return "other";
}

/** Documentos de un hogar residencial (establecimiento). Mismos nombres que antes. */
export const RESIDENTIAL_ESTABLISHMENT_DOCUMENTS = [
  "Licencia del Departamento de la Familia",
  "Certificación de Bomberos",
  "Licencia sanitaria",
  "Póliza de responsabilidad",
  "Menú certificado",
] as const;

/** Expediente de un residente de un hogar residencial. Mismos nombres que antes. */
export const RESIDENTIAL_RESIDENT_DOCUMENTS = [
  "Expediente de ingreso",
  "Evaluación médica",
  "Evaluación dental",
  "Consentimiento",
  "Identificación",
] as const;

/**
 * ¿Se muestran el cumplimiento de establecimientos y los expedientes de residentes?
 * Sí cuando la organización tiene establecimientos (hogares residenciales) o es un hogar
 * residencial que todavía no registró el suyo. Una agencia domiciliaria sin establecimientos, no.
 */
export function showsResidentialCompliance(modality: CareModality, activeEstablishments: number): boolean {
  return activeEstablishments > 0 || modality === "residential";
}

export const normalizeDocumentType = (value: string) => value.trim().toLocaleLowerCase("es-PR");

/** Aviso único: ETNARA no declara cumplimiento legal. */
export const COMPLIANCE_RESPONSIBILITY_NOTICE =
  "ETNARA organiza tus documentos y te avisa de faltantes y vencimientos según la lista de tu organización. No certifica el cumplimiento legal: cada organización es responsable de sus obligaciones.";
