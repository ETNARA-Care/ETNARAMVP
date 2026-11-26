/**
 * «Crear turno» deshabilitado (26-nov-2026): por qué no hay personal apto, para explicarlo junto al botón.
 * Solo describe el resultado del cumplimiento que ya calculó el backend; no cambia ninguna regla de elegibilidad.
 */
export type NoEligibleStaffReason = "noStaff" | "unconfigured" | "notEligible";

export function noEligibleStaffReason(workers: ReadonlyArray<{ compliance: { eligibility: string } }>): NoEligibleStaffReason | null {
  if (workers.some((w) => w.compliance.eligibility === "eligible")) return null;
  if (workers.length === 0) return "noStaff";
  if (workers.every((w) => w.compliance.eligibility === "unconfigured")) return "unconfigured";
  return "notEligible";
}
