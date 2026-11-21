import { apiClient } from "./client";

/**
 * Módulo contractual (backend 152, Etapas 1 y 2). Con el módulo apagado en el servidor las rutas
 * responden 404 y el portal no muestra nada. Solo la administración de la agencia firma; ETNARA
 * Central consulta, nunca acepta.
 */
export type ContractAcceptanceState = "accepted" | "pending" | "covered";

export interface AgencyContract {
  id: string; document_id: string; code: string; title: string; kind: string;
  version_label: string; status: "published"; is_test: boolean; requires_new_acceptance: boolean;
  content_sha256: string; published_at: string; body_length: number;
  acceptance: ContractAcceptanceState;
  isNewVersion: boolean;
  currentAcceptance: { id: string; acceptedAt: string; signerFullName: string; signerTitle: string } | null;
  previousAcceptance: { id: string; versionLabel: string; acceptedAt: string } | null;
}

export interface AgencyContractVersion {
  id: string; document_id: string; code: string; title: string; kind: string;
  version_label: string; status: "published" | "retired"; is_test: boolean; requires_new_acceptance: boolean;
  content_sha256: string; published_at: string; retired_at: string | null; body: string;
  organization_name: string; authorityDeclaration: string; acceptanceStatementTemplate: string;
  /** 153: texto de la primera casilla (lo fija el servidor). */
  acceptanceCheckboxText?: string;
  /** 153: ¿esta persona puede firmar? (representante designada por la agencia ante ETNARA). */
  signer?: { allowed: boolean; blockedReason?: "TEST_DOCUMENT" | "NOT_DESIGNATED" | null; designationRequired: boolean; designation: { fullName: string; title: string } | null; legallyApproved: boolean };
  commercial_status?: "not_applicable" | "proposal" | "commercially_approved";
  legal_status?: "pending_legal_approval" | "legally_approved";
  /** 153: condiciones comerciales de una Orden de Suscripción (solo informativas; ningún cobro automático). */
  commercial_terms?: SubscriptionOrderTerms | null;
  /** 156: Word original aprobado, si ETNARA lo guardó (se descarga íntegro, con su huella). */
  sourceFile?: { fileName: string; byteSize: number; sha256: string } | null;
}

/** Condiciones individuales de la Orden (153). Siempre propuesta; el servidor fija las salvaguardas. */
export interface SubscriptionOrderTerms {
  status?: "proposal"; planName?: string; features?: string[]; limits?: string | null;
  pricing?: { currency: "USD"; proposedMonthlyPriceUsd: number | null; isProposal: true };
  promotions?: Array<{ description: string; durationDays: number | null }>;
  addOns?: Array<{ name: string; proposedMonthlyPriceUsd: number | null }>;
  conditions?: string[];
  foundingProgram?: { enrolled: true; programStatus: string; proposedBenefits: string[] } | null;
  chargesRequireExpressAcceptance?: boolean; automaticCharges?: boolean; automaticRenewal?: boolean; billingActivated?: boolean;
}

/** 153: estado contractual de la agencia. Con las reglas apagadas en el servidor es solo informativo. */
export interface ContractStatus {
  serverEnforcementEnabled: boolean; mode: "off" | "notice" | "restrict_new_operations" | "contract_only";
  enforceFrom: string | null; satisfied: boolean; pendingRequired: number; notice: boolean; restricted: boolean;
}

export interface AgencyContractAcceptance {
  id: string; document_version_id: string; version_label: string; code: string; title: string; content_sha256: string; is_test: boolean;
  accepted_by_login: string; accepted_role: string; signer_full_name: string; signer_title: string; authority_declaration: string;
  acceptance_statement: string; accepted_at: string; verification_method: "EMAIL_CODE"; version_status: "published" | "retired";
}

export interface SignerInput { signerFullName: string; signerTitle: string; confirmAuthority: true; confirm: true; contentSha256: string }
export interface SignatureCode { challengeId: string; emailMasked: string; expiresAt: string; resendAfterSeconds: number }

export interface CentralContractsOverview {
  documents: Array<{ documentId: string; code: string; title: string; versionId: string; versionLabel: string; isTest: boolean; requiresNewAcceptance: boolean }>;
  organizations: Array<{
    organizationId: string; name: string; status: string;
    contracts: Array<{ versionId: string; state: ContractAcceptanceState; accepted: { versionLabel: string; acceptedAt: string; signerFullName: string; signerTitle: string } | null }>;
  }>;
}

const base = (o: string) => `/organizations/${o}/contracts`;
export const contractsApi = {
  list: (o: string, t: string) => apiClient.get<{ contracts: AgencyContract[] }>(base(o), t),
  version: (o: string, v: string, t: string) => apiClient.get<{ version: AgencyContractVersion }>(`${base(o)}/versions/${v}`, t),
  acceptances: (o: string, t: string) => apiClient.get<{ acceptances: AgencyContractAcceptance[] }>(`${base(o)}/acceptances`, t),
  requestCode: (o: string, v: string, t: string, input: SignerInput) => apiClient.post<SignatureCode>(`${base(o)}/versions/${v}/signature-code`, input, t),
  accept: (o: string, v: string, t: string, input: SignerInput & { challengeId: string; code: string }) =>
    apiClient.post<{ acceptance: AgencyContractAcceptance & { verified_email: string } }>(`${base(o)}/versions/${v}/accept`, input, t),
  documentFile: (o: string, v: string, t: string, format: "pdf" | "txt" | "docx") => apiClient.getBinary(`${base(o)}/versions/${v}/document.${format}`, t),
  certificate: (o: string, a: string, t: string) => apiClient.getBinary(`${base(o)}/acceptances/${a}/certificate.pdf`, t),
  status: (o: string, t: string) => apiClient.get<{ status: ContractStatus }>(`${base(o)}/status`, t),
  centralOverview: (t: string) => apiClient.get<CentralContractsOverview>(`/platform/contracts/overview`, t),
};

/**
 * 158: herramientas de ETNARA Central (solo superadministración). Reutilizan las rutas del módulo
 * contractual: documentos de PRUEBA dirigidos a una agencia, representantes designadas, estado y
 * aceptaciones, y retiro con motivo (nunca borra evidencias). Central nunca firma por nadie.
 */
export interface CentralVersion {
  id: string; document_id: string; version_label: string; status: "draft" | "published" | "retired"; is_test: boolean;
  content_sha256: string; created_at: string; published_at: string | null; retired_at: string | null; acceptances: number;
}
export interface CentralDocument {
  id: string; code: string; title: string; kind: string; is_test: boolean; created_at: string;
  organization_id: string | null; organization_name: string | null; versions: CentralVersion[];
}
export interface CentralAcceptance {
  organization_id: string; organization_name: string; accepted_by_login: string; accepted_role: string; signer_full_name: string;
  signer_title: string; verification_method: string; accepted_at: string; content_sha256: string; is_test: boolean;
}
export interface CentralSignatory { id: string; user_id: string; full_name: string; title: string; basis: string; designated_at: string; revoked_at: string | null }
export interface EligibleSignatory { userId: string; email: string }
const pc = "/platform/contracts";
export const centralContractsApi = {
  documents: (t: string) => apiClient.get<{ documents: CentralDocument[] }>(pc, t),
  createTestDocument: (t: string, input: { code: string; title: string; organizationId: string }) =>
    apiClient.post<{ document: { id: string } }>(`${pc}/documents`, { ...input, kind: "SERVICE_AGREEMENT", isTest: true, requiredForOperation: false }, t),
  createVersion: (t: string, documentId: string, body: string) =>
    apiClient.post<{ version: CentralVersion }>(`${pc}/documents/${documentId}/versions`, { versionLabel: "1.0", body }, t),
  publish: (t: string, versionId: string) => apiClient.post<{ version: CentralVersion }>(`${pc}/versions/${versionId}/publish`, {}, t),
  retire: (t: string, versionId: string, reason: string) => apiClient.post<{ version: CentralVersion }>(`${pc}/versions/${versionId}/retire`, { reason }, t),
  acceptances: (t: string, versionId: string) => apiClient.get<{ acceptances: CentralAcceptance[] }>(`${pc}/versions/${versionId}/acceptances`, t),
  signatories: (t: string, o: string) => apiClient.get<{ signatories: CentralSignatory[] }>(`${pc}/organizations/${o}/signatories`, t),
  eligible: (t: string, o: string) => apiClient.get<{ eligible: EligibleSignatory[] }>(`${pc}/organizations/${o}/eligible-signatories`, t),
  designate: (t: string, o: string, input: { userId: string; fullName: string; title: string; basis: string }) =>
    apiClient.post<{ signatory: CentralSignatory }>(`${pc}/organizations/${o}/signatories`, input, t),
  revoke: (t: string, o: string, id: string, reason: string) => apiClient.post<{ signatory: { id: string } }>(`${pc}/organizations/${o}/signatories/${id}/revoke`, { reason }, t),
};

/** Marcas obligatorias de un documento de prueba (la base también las exige). */
export const TEST_BANNER = "DOCUMENTO FICTICIO DE PRUEBA — PRUEBA — SIN VALOR CONTRACTUAL. No es el contrato oficial de ETNARA Care.";
export function testDocumentTitle(title: string) {
  const t = title.trim().replace(/^\[PRUEBA\]\s*/i, "");
  return `[PRUEBA] ${t}${/SIN VALOR CONTRACTUAL/i.test(t) ? "" : " — SIN VALOR CONTRACTUAL"}`.slice(0, 200);
}
export function testDocumentBody(text: string) {
  const t = text.trim();
  return t.startsWith("DOCUMENTO FICTICIO DE PRUEBA") ? `${t}\n` : `${TEST_BANNER}\n\n${t}\n`;
}
export function testDocumentCode(orgName: string, now = new Date()) {
  const slug = orgName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "AGENCIA";
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return `TEST_${slug}_${stamp}`;
}
export function centralContractError(code?: string, status?: number): string {
  switch (code) {
    case "CONTRACT_SIGNATORY_MUST_BE_ACTIVE_ADMIN": return "Solo se puede designar a una administradora o administrador activo de esta agencia.";
    case "CONTRACT_SIGNATORY_ALREADY_DESIGNATED": return "Esa persona ya está designada como representante de esta agencia.";
    case "CONTRACT_CODE_TAKEN": return "Ya existe un documento con ese código. Inténtalo de nuevo en un minuto.";
    case "CONTRACT_VERSION_INVALID_TRANSITION": return "Ese documento ya no está vigente.";
    case "CONTRACT_VERSION_IMMUTABLE": return "Esa versión ya se publicó y no se puede cambiar.";
    case "CONTRACT_SCOPE_TEST_ONLY": return "Solo los documentos de prueba se pueden dirigir a una agencia.";
    case "CONTRACT_INVALID_DOCUMENT": case "CONTRACT_TEST_BANNER_REQUIRED": return "El documento no cumple las marcas de prueba obligatorias.";
    case "CONTRACT_NOT_FOUND": return "No se encontró. Recarga la página.";
    case "PLATFORM_ACCESS_DENIED": return "Solo ETNARA Central puede hacer esto.";
    case "INVALID_PAYLOAD": return "Revisa los datos: nombre y apellido, cargo y un fundamento de al menos 10 caracteres; los motivos, de al menos 5.";
    default: return status === 404 ? "El módulo de contratos está apagado en el servidor." : status === 0 ? "Sin conexión." : "No se pudo completar. Inténtalo de nuevo.";
  }
}

/** Guarda un archivo recibido con la sesión (nunca por un enlace público). */
/** 156: términos individuales de la función de cada persona (Anexo E del contrato). */
export type RoleTermsRole = "ADMINISTRATION" | "CAREGIVER" | "FAMILY";
export interface RoleTermsItem {
  id: string; role: RoleTermsRole; version_label: string; title: string; body: string; content_sha256: string; is_test: boolean;
  published_at: string; accepted: boolean; acceptedAt: string | null; acceptable: boolean; blockedReason: "TEST_DOCUMENT" | null;
}
export interface MyRoleTerms { roles: RoleTermsRole[]; items: RoleTermsItem[]; checkboxText: string }
const termsBase = (o: string) => `/organizations/${o}/role-terms`;
export const roleTermsApi = {
  mine: (o: string, t: string) => apiClient.get<MyRoleTerms>(termsBase(o), t),
  accept: (o: string, id: string, t: string, contentSha256: string) =>
    apiClient.post<{ acceptance: { id: string; accepted_at: string } }>(`${termsBase(o)}/${id}/accept`, { contentSha256, confirm: true }, t),
  pdf: (o: string, id: string, t: string) => apiClient.getBinary(`${termsBase(o)}/${id}/document.pdf`, t),
};

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Mensajes en español para los códigos del servidor (sin datos internos). */
export function contractErrorMessage(code?: string, status?: number): string {
  switch (code) {
    case "CONTRACT_CODE_INVALID": return "El código no es correcto. Revisa el correo e inténtalo otra vez.";
    case "CONTRACT_CODE_EXPIRED": return "El código venció (dura 10 minutos). Pide uno nuevo.";
    case "CONTRACT_CODE_TOO_MANY_ATTEMPTS": return "Demasiados intentos con este código. Pide uno nuevo.";
    case "CONTRACT_CODE_ALREADY_USED": return "Ese código ya se usó. Pide uno nuevo si aún no firmaste.";
    case "CONTRACT_CODE_RESEND_TOO_SOON": return "Espera un minuto antes de pedir otro código.";
    case "CONTRACT_CODE_RATE_LIMITED": return "Pediste demasiados códigos. Inténtalo de nuevo en una hora.";
    case "CONTRACT_CODE_DELIVERY_FAILED": return "No pudimos enviar el código a tu correo. Inténtalo más tarde o escribe a soporte.";
    case "CONTRACT_CONTENT_MISMATCH": return "El documento cambió mientras lo leías. Vuelve a abrirlo antes de firmar.";
    case "CONTRACT_VERSION_NOT_ACCEPTABLE": return "Esta versión ya no está vigente. Abre la versión actual.";
    case "CONTRACT_SIGNATORY_NOT_DESIGNATED": return "Tu cuenta no figura como representante designada de la organización ante ETNARA. Pide a ETNARA que registre a la persona con autoridad para firmar.";
    case "CONTRACT_ACCEPTANCE_REQUIRED": return "Tu organización tiene contratos pendientes de aceptar. Complétalos en Contratos para continuar con esta acción.";
    case "CONTRACT_LEGAL_APPROVAL_REQUIRED": return "Este documento todavía no está aprobado para firma.";
    case "CONTRACT_TEST_DOCUMENT_NOT_SIGNABLE": return "Este es un documento de prueba: se puede leer, pero no firmar.";
    case "CONTRACT_COMMERCIAL_APPROVAL_REQUIRED": return "Esta Orden todavía no está aprobada para firma.";
    case "CONTRACT_PLACEHOLDER_TEXT_NOT_ALLOWED": case "CONTRACT_DRAFT_MARKED_NOT_SIGNABLE": return "Este documento es un borrador y no se puede firmar.";
    case "CONTRACT_ALREADY_ACCEPTED": return "Tu organización ya aceptó esta versión.";
    case "ROLE_TERMS_ROLE_MISMATCH": return "Estos términos no corresponden a tu función en esta organización.";
    case "CONTRACT_FORBIDDEN": case "ORGANIZATION_ACCESS_DENIED": return "Solo una administradora o administrador activo de la organización puede firmar.";
    case "INVALID_PAYLOAD": return "Revisa los datos: nombre y apellido, cargo y las dos casillas.";
    default: return status === 0 ? "Sin conexión. Inténtalo cuando vuelva la señal." : "No se pudo completar. Inténtalo de nuevo.";
  }
}
