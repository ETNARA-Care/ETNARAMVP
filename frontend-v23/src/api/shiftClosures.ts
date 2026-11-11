import { apiClient } from "./client";

/**
 * 154 — Turnos terminados sin servicio. Cerrar no borra nada: el turno, sus asignaciones y su
 * historial quedan intactos; el cierre guarda quién, cuándo, el motivo y la nota. Un turno cerrado
 * nunca cuenta como servicio prestado ni se factura.
 */
export type ClosureOutcome = "not_covered" | "not_performed";
export type ClosureReason =
  | "no_caregiver_available"
  | "family_cancelled"
  | "recipient_absent_or_hospitalized"
  | "caregiver_no_show"
  | "other";

export interface ShiftClosure {
  id: string;
  shiftId: string;
  outcome: ClosureOutcome;
  reasonCode: ClosureReason;
  note: string;
  closedAt: string;
  closedByEmail: string | null;
  /** Rectificación de un cierre hecho por error: el registro original se conserva. */
  rectifiedAt: string | null;
  rectifiedByEmail: string | null;
  rectificationReason: string | null;
}

export interface ShiftAttention {
  shiftId: string;
  ended: boolean;
  status: string;
  hasCheckIn: boolean;
  outcome: ClosureOutcome;
  canClose: boolean;
  canCorrectOmittedVisit: boolean;
  allowedReasons: ClosureReason[];
  acceptedCaregivers: { membershipId: string; name: string; checkedIn: boolean }[];
  closure: ShiftClosure | null;
  rectifiedClosures: ShiftClosure[];
  /** Solo una administradora rectifica un cierre. */
  canRectify: boolean;
  closureContradicted: boolean;
}

export interface ShiftClosureHistoryItem extends ShiftClosure {
  scheduledStart: string;
  scheduledEnd: string;
  recipientName: string | null;
  contradicted: boolean;
}

export const getShiftAttention = (organizationId: string, shiftId: string, token: string) =>
  apiClient.get<ShiftAttention>(`/organizations/${organizationId}/shifts/${shiftId}/attention`, token);

export async function closeShiftWithoutService(
  organizationId: string, shiftId: string, input: { reasonCode: ClosureReason; note: string }, token: string,
): Promise<ShiftClosure> {
  const r = await apiClient.post<{ closure: ShiftClosure }>(`/organizations/${organizationId}/shifts/${shiftId}/close-without-service`, input, token);
  return r.closure;
}

export const recordOmittedVisitCorrection = (
  organizationId: string, shiftId: string, input: { organizationWorkerMembershipId: string; reason: string }, token: string,
) => apiClient.post<{ shiftId: string; recordedAt: string; timesheet: { id: string; status: string } | null }>(
  `/organizations/${organizationId}/shifts/${shiftId}/verification/omitted-visit-correction`, input, token);

export async function rectifyShiftClosure(organizationId: string, closureId: string, reason: string, token: string): Promise<ShiftClosure> {
  const r = await apiClient.post<{ closure: ShiftClosure }>(`/organizations/${organizationId}/shift-closures/${closureId}/rectify`, { reason }, token);
  return r.closure;
}

export async function listShiftClosures(organizationId: string, token: string): Promise<ShiftClosureHistoryItem[]> {
  const r = await apiClient.get<{ closures: ShiftClosureHistoryItem[] }>(`/organizations/${organizationId}/shift-closures?limit=100`, token);
  return r.closures;
}

export const CLOSURE_REASON_LABELS: Record<ClosureReason, string> = {
  no_caregiver_available: "No hubo cuidador disponible",
  family_cancelled: "La familia canceló el servicio",
  recipient_absent_or_hospitalized: "El residente estaba ausente u hospitalizado",
  caregiver_no_show: "El cuidador no se presentó",
  other: "Otro motivo",
};

export const CLOSURE_OUTCOME_LABELS: Record<ClosureOutcome, string> = {
  not_covered: "Cerrado como no cubierto",
  not_performed: "Cerrado: servicio no prestado",
};

/** Minimum note length the server requires («Otro motivo» needs a fuller explanation). */
export const closureNoteMin = (reason: ClosureReason | null) => (reason === "other" ? 20 : 10);
export const CORRECTION_REASON_MIN = 20;
export const RECTIFICATION_REASON_MIN = 20;
/** Etiqueta visual única para un turno con cierre vigente. */
export const CLOSED_WITHOUT_SERVICE_LABEL = "Cerrado sin servicio";

export function shiftClosureErrorMessage(code: string | undefined): string {
  switch (code) {
    case "SHIFT_CLOSURE_NOTE_REQUIRED": return "Escribe una nota de cierre más completa.";
    case "SHIFT_CLOSURE_REASON_INVALID": return "Ese motivo no corresponde a este turno.";
    case "SHIFT_CLOSURE_ALREADY_CLOSED": return "Este turno ya fue cerrado.";
    case "SHIFT_CLOSURE_HAS_CHECK_IN": return "Este turno tiene registro de entrada: no se puede cerrar como no prestado.";
    case "SHIFT_CLOSURE_NOT_ENDED": return "El turno aún no ha terminado.";
    case "SHIFT_CLOSURE_NOT_CLOSABLE": return "Este turno ya no está pendiente.";
    case "SHIFT_CLOSED_WITHOUT_SERVICE": return "Este turno ya se cerró sin servicio.";
    case "NO_ACCEPTED_ASSIGNMENT": return "Ese cuidador no tenía el turno aceptado.";
    case "ALREADY_CHECKED_IN": return "Ese cuidador ya tiene registro de entrada.";
    case "SHIFT_NOT_CORRECTABLE": return "Este turno ya no admite la corrección.";
    case "SHIFT_CLOSURE_RECTIFY_FORBIDDEN": return "Solo una administradora de la agencia puede rectificar un cierre.";
    case "SHIFT_CLOSURE_ALREADY_RECTIFIED": return "Este cierre ya fue rectificado.";
    case "SHIFT_CLOSURE_RECTIFY_REASON_REQUIRED": return "Explica por qué el cierre fue un error.";
    case "REQUIRES_ORG_MANAGER": return "Solo la administración o supervisión de la agencia puede hacerlo.";
    case "INVALID_PAYLOAD": return "Revisa los datos: falta información o es demasiado corta.";
    default: return "No se pudo guardar. Intenta nuevamente.";
  }
}
