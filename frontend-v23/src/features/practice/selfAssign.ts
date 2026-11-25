import { apiClient, type ApiError } from "@/api/client";
import type { Assignment } from "@/api/shifts";
import type { ComplianceSummary } from "@/api/compliance";

/**
 * 160 (PR B): «Asignármelo» del cuidador independiente. Un solo endpoint del backend asigna y acepta en una
 * transacción con las MISMAS reglas de Turnos: elegibilidad, turno abierto, su agenda en todas sus organizaciones.
 * El portal no decide la elegibilidad: solo explica la respuesta.
 *
 * 161 (documentos autodeclarados): con requisitos propios faltantes o vencidos el backend responde
 * SELF_DECLARATION_CONFIRMATION_REQUIRED; la persona puede confirmar expresamente (auditado) y reintentar.
 */
export type SelfAssignResult =
  | { kind: "assigned"; assignment: Assignment }
  | { kind: "not_eligible"; unconfigured: boolean }
  | { kind: "conflict" }
  | { kind: "confirmation_required" }
  | { kind: "error"; message: string };

export const SELF_DECLARATION_STATEMENT = "Confirmo que cumplo los requisitos de este servicio.";
export const SELF_DECLARATION_NOTICE =
  "ETNARA Care no verifica ni certifica documentos. Esta confirmación no sustituye los requisitos legales que te correspondan.";

export function selfAssignPath(organizationId: string, shiftId: string): string {
  return `/organizations/${organizationId}/me/shifts/${shiftId}/self-assign`;
}

export function interpretSelfAssignError(error: unknown): SelfAssignResult {
  const code = (error as ApiError | null)?.code ?? "";
  if (code === "NO_APPLICABLE_REQUIREMENT_SET") return { kind: "not_eligible", unconfigured: true };
  if (code.startsWith("WORKER_NOT_ELIGIBLE")) return { kind: "not_eligible", unconfigured: false };
  if (code === "MY_SCHEDULE_CONFLICT" || code === "SCHEDULE_CONFLICT") return { kind: "conflict" };
  if (code === "SELF_DECLARATION_CONFIRMATION_REQUIRED") return { kind: "confirmation_required" };
  if (code === "ASSIGNMENT_ALREADY_EXISTS" || code === "ASSIGNMENT_ALREADY_RESPONDED") return { kind: "error", message: "Este turno ya tiene a alguien asignado." };
  if (code === "SHIFT_CANCELLED") return { kind: "error", message: "El turno está cancelado." };
  return { kind: "error", message: "No pudimos asignarte el turno. Inténtalo de nuevo." };
}

/** 161: con `confirmSelfDeclaration` la persona confirma expresamente (el backend lo audita). Solo tras su decisión. */
export async function selfAssignShift(organizationId: string, shiftId: string, token: string, options: { confirmSelfDeclaration?: true } = {}): Promise<SelfAssignResult> {
  try {
    const result = await apiClient.post<{ assignment: Assignment }>(selfAssignPath(organizationId, shiftId), options.confirmSelfDeclaration ? { confirmSelfDeclaration: true } : {}, token);
    return { kind: "assigned", assignment: result.assignment };
  } catch (error) {
    return interpretSelfAssignError(error);
  }
}

/** Texto para la persona independiente: sin «aprobación de la agencia» ni verificación de ETNARA. */
export function selfAssignMessage(result: SelfAssignResult): string {
  switch (result.kind) {
    case "assigned": return "Turno asignado a ti y confirmado.";
    case "not_eligible": return result.unconfigured
      ? "Todavía no puedes asignarte turnos: tus documentos de práctica aún no están configurados."
      : "Todavía no puedes asignarte este turno: hay requisitos de documentos pendientes.";
    case "conflict": return "Ya tienes otro turno confirmado a esa hora (en esta práctica o en otra organización).";
    case "confirmation_required": return SELF_DECLARATION_NOTICE;
    case "error": return result.message;
  }
}

/** Pendientes legibles de su propio resumen de requisitos (sin palabras de aprobación ni certificación). */
export function practicePendingItems(summary: ComplianceSummary | null | undefined): string[] {
  if (!summary || summary.eligibility === "eligible") return [];
  if (summary.eligibility === "unconfigured") return ["Documentos de práctica sin configurar"];
  const label: Record<string, string> = {
    MISSING_CREDENTIAL: "Falta registrar",
    CREDENTIAL_NOT_ACTIVE: "No vigente",
    CREDENTIAL_EXPIRED: "Vencido",
    CREDENTIAL_REVOKED: "No vigente",
  };
  return summary.requirements
    .filter((item) => item.isMandatory && item.status !== "satisfied")
    .map((item) => `${label[item.status] ?? "Pendiente"}: ${item.requirement.replaceAll("_", " ")}`);
}
