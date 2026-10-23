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
/** "25 oct 2026, 10:00 a. m." -- explicit parts: dateStyle "medium" renders 10/25/2026 in es-PR. */
export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-PR", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico",
  });
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

/** Opciones de función (iguales a las del servidor); "Otro" permite texto libre validado. */
export const ROLE_OPTIONS = [
  "Cuidador/a",
  "Acompañante",
  "Asistente de cuidado personal",
  "Cuidado nocturno",
  "Relevo (respiro familiar)",
] as const;

/** Espejo de la validación del servidor: un título de función, nunca nombres, teléfonos ni direcciones. */
export function roleLabelProblem(value: string): string | null {
  const role = value.trim();
  if (!role) return "Escribe la función requerida.";
  if (role.length > 60) return "Máximo 60 caracteres.";
  if ((ROLE_OPTIONS as readonly string[]).includes(role)) return null;
  if (/\d/.test(role)) return "No incluyas números (teléfonos, direcciones o edades).";
  if (!/^[\p{L} /().,'-]+$/u.test(role)) return "Usa solo letras: sin correos, símbolos ni direcciones.";
  if (/\b(sr|sra|srta|don|doña|dona)\b\.?/i.test(role)) return "No incluyas nombres de personas.";
  if (/\b(paciente|residente|participante|diagn[oó]stico|demencia|alzheimer|c[aá]ncer|di[aá]lisis)\b/i.test(role)) return "No incluyas información del paciente ni datos clínicos.";
  if (/\b(calle|ave|avenida|urb|urbanizaci[oó]n|carr|carretera|apt|apartamento|edif|edificio|barrio|bo|km|cond|condominio)\b\.?/i.test(role)) return "No incluyas direcciones; el municipio ya indica la zona.";
  return null;
}
