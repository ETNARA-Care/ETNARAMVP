import type { ApiError } from "@/api/client";
import type { ApplicationStatus, DecisionReason, OpportunityStatus } from "@/api/smartmatch";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

/** Fecha y horario en hora de Puerto Rico. */
export function formatWindow(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Puerto_Rico" });
  const time = (d: Date) => d.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });
  return `${day} · ${time(start)} – ${time(end)}`;
}
export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Puerto_Rico" });
}

export function applicationLabel(status: ApplicationStatus, reason: DecisionReason | null): { label: string; tone: Tone } {
  switch (status) {
    case "PENDING": return { label: "Pendiente", tone: "warning" };
    case "APPROVED": return { label: "Aprobada", tone: "success" };
    case "WITHDRAWN": return { label: "Retirada", tone: "neutral" };
    case "REJECTED": return reason === "OPPORTUNITY_FILLED"
      ? { label: "Cubierta por otra persona", tone: "neutral" }
      : { label: "Rechazada", tone: "danger" };
  }
}

export function opportunityLabel(status: OpportunityStatus): { label: string; tone: Tone } {
  switch (status) {
    case "DRAFT": return { label: "Borrador", tone: "neutral" };
    case "PUBLISHED": return { label: "Publicada", tone: "accent" };
    case "FILLED": return { label: "Cubierta", tone: "success" };
    case "CANCELLED": return { label: "Cancelada", tone: "neutral" };
    case "EXPIRED": return { label: "Vencida", tone: "neutral" };
  }
}

export const EVENT_LABELS: Record<string, string> = {
  SUBMITTED: "Solicitud enviada",
  WITHDRAWN: "Solicitud retirada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};
export const REASON_LABELS: Record<string, string> = {
  APPROVED_ELIGIBLE: "Cumple todos los requisitos verificados",
  AGENCY_REJECTED: "Decisión de la agencia",
  OPPORTUNITY_FILLED: "La oportunidad se cubrió con otra persona",
};

/** Mensajes claros para cada error conocido del backend. */
export function smartMatchErrorMessage(error: unknown, fallback: string): string {
  const e = error as ApiError | undefined;
  if (e?.isNetworkError) return "Sin conexión con ETNARA. Revisa tu internet e inténtalo de nuevo.";
  switch (e?.code) {
    case "DUPLICATE_APPLICATION": return "Ya tienes una solicitud abierta para esta oportunidad.";
    case "OPPORTUNITY_NOT_AVAILABLE": return "Esta oportunidad ya no está disponible.";
    case "CONSENT_REQUIRED": return "Debes aceptar el consentimiento para solicitar.";
    case "APPLICATION_NOT_PENDING": return "Esta solicitud ya no está pendiente. Actualizamos la información.";
    case "OPPORTUNITY_NOT_OPEN": return "La oportunidad ya no está abierta (cubierta, cancelada o vencida).";
    case "APPROVAL_BLOCKED": return "No se puede aprobar: falta información verificable. Revisa los requisitos.";
    case "CONCURRENT_UPDATE_RETRY": return "Otra persona estaba actuando a la vez. Inténtalo de nuevo.";
    case "NOT_FOUND_OR_NOT_PUBLISHABLE": return "Este borrador ya no se puede publicar (ya publicado o con fecha pasada).";
    case "NOT_FOUND": return "No encontramos este registro en tu agencia.";
    case "FORBIDDEN": return "Tu cuenta no tiene permiso para esta acción.";
    case "INVALID_REQUEST": return "Revisa los datos: la hora de fin debe ser posterior al inicio.";
    default: return fallback;
  }
}
