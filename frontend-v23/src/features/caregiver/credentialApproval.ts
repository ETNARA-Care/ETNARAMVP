/**
 * «Aprobada por tu agencia» en «Mis credenciales» del cuidador.
 *
 * `verificationStatus === "verified"` solo existe cuando ESTA agencia registró una revisión aprobada
 * (organization_credential_reviews.review_status = 'approved'; el backend lo calcula para la organización
 * activa). ETNARA no verifica ni certifica credenciales: el texto atribuye la aprobación a la agencia.
 * Se muestra únicamente si TODAS las credenciales listadas tienen esa revisión aprobada y ninguna está
 * vencida; con una sola pendiente, rechazada o vencida, no aparece.
 */
export const AGENCY_APPROVAL_LABEL = "Aprobada por tu agencia";

export interface ApprovalInput { status: string; verificationStatus: "verified" | "pending" | "rejected" }

export function showAgencyApproval(credentials: readonly ApprovalInput[] | null | undefined): boolean {
  if (!credentials || credentials.length === 0) return false;
  return credentials.every((c) => c.verificationStatus === "verified" && c.status !== "expired");
}
