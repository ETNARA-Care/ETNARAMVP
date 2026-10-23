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

/** Estado del turno creado desde una oportunidad cubierta. */
export function shiftLinkLabel(opp: { status: OpportunityStatus; shift_id?: string | null; shift_status?: string | null; shift_assignment_status?: string | null }): { label: string; tone: Tone } | null {
  if (opp.status !== "FILLED") return null;
  if (!opp.shift_id) return { label: "Cubierta — pendiente de asignación", tone: "warning" };
  if (opp.shift_status === "cancelled") return { label: "Turno cancelado en Turnos", tone: "neutral" };
  if (opp.shift_assignment_status === "accepted") return { label: "Turno creado · aceptado", tone: "success" };
  if (opp.shift_assignment_status === "rejected") return { label: "Turno creado · rechazado por la cuidadora", tone: "danger" };
  return { label: "Turno creado · esperando respuesta", tone: "accent" };
}

export const CANCELLATION_REASONS = {
  NO_LONGER_NEEDED: "Ya no se necesita el servicio",
  SCHEDULE_CHANGED: "Cambió el horario",
  COVERED_OTHERWISE: "Se cubrió por otra vía",
  OTHER: "Otro motivo",
} as const;

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
    case "SHIFT_ALREADY_CREATED": return "Ya se creó un turno para esta oportunidad.";
    case "LINKED_SHIFT_ACTIVE": return "Esta oportunidad tiene un turno activo. Cancélalo o reasígnalo primero en Turnos.";
    case "SERVICE_LOCATION_REQUIRED": return "Confirma la dirección del servicio.";
    case "SERVICE_LOCATION_NOT_IN_RECIPIENT": return "La dirección no pertenece a esa persona.";
    case "OPPORTUNITY_NOT_FILLED": return "Primero aprueba una solicitud: la oportunidad todavía no está cubierta.";
    case "OPPORTUNITY_STARTED": return "El horario de esta oportunidad ya comenzó; crea el turno manualmente en Turnos.";
    case "CAREGIVER_NOT_READY": return "La cuidadora ya no cumple los requisitos (credenciales, membresía o disponibilidad). Revisa Cumplimiento.";
    case "RECIPIENT_NOT_IN_AGENCY": return "Selecciona una persona atendida activa de tu agencia.";
    case "SCHEDULE_CONFLICT": return "La cuidadora ya tiene otro turno en ese horario.";
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
