/** How a report's status reads for the caregiver (F2). */
export function caregiverStatus(status: string, canEdit: boolean): { text: string; tone: "neutral" | "success" | "warning" | "accent" | "danger" } {
  if (status === "APPROVED") return { text: "Aprobado", tone: "success" };
  if (status === "SUBMITTED") return { text: "En revisión de la agencia", tone: "accent" };
  if (status === "RETURNED") return canEdit ? { text: "Devuelto: revisa", tone: "danger" } : { text: "Devuelto · plazo vencido", tone: "neutral" };
  return canEdit ? { text: "Por revisar", tone: "warning" } : { text: "Plazo vencido", tone: "neutral" };
}
