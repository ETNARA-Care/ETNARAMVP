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
  documentFile: (o: string, v: string, t: string, format: "pdf" | "txt") => apiClient.getBinary(`${base(o)}/versions/${v}/document.${format}`, t),
  certificate: (o: string, a: string, t: string) => apiClient.getBinary(`${base(o)}/acceptances/${a}/certificate.pdf`, t),
  centralOverview: (t: string) => apiClient.get<CentralContractsOverview>(`/platform/contracts/overview`, t),
};

/** Guarda un archivo recibido con la sesión (nunca por un enlace público). */
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
    case "CONTRACT_ALREADY_ACCEPTED": return "Tu organización ya aceptó esta versión.";
    case "CONTRACT_FORBIDDEN": case "ORGANIZATION_ACCESS_DENIED": return "Solo una administradora o administrador activo de la organización puede firmar.";
    case "INVALID_PAYLOAD": return "Revisa los datos: nombre y apellido, cargo y las dos casillas.";
    default: return status === 0 ? "Sin conexión. Inténtalo cuando vuelva la señal." : "No se pudo completar. Inténtalo de nuevo.";
  }
}
