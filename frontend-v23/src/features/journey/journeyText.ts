import type { DelayReason, JourneyRisk, JourneyStateName } from "@/api/journey";

export const time = (v: string) => new Date(v).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit", timeZone: "America/Puerto_Rico" });

export const DELAY_REASON_TEXT: Record<DelayReason, string> = {
  TRAFFIC: "Tráfico",
  PREVIOUS_SERVICE: "Servicio anterior se extendió",
  TRANSPORT: "Transporte o vehículo",
  WEATHER: "Clima",
  OTHER: "Otro imprevisto",
};

/** Family / agency wording. «Llegó» never says whether the arrival is under review (decision 6). */
export const STATE_TEXT: Record<JourneyStateName, string> = {
  UNASSIGNED: "Por confirmar",
  PENDING_ACCEPTANCE: "Por confirmar",
  ASSIGNED: "Cuidadora asignada",
  EN_ROUTE: "En camino",
  ARRIVED: "Llegada registrada",
  IN_SERVICE: "Servicio iniciado",
  COMPLETED: "Servicio finalizado",
  CANCELLED: "Turno cancelado",
};

export const RISK_TEXT: Record<JourneyRisk, string> = {
  NOT_EN_ROUTE: "Aún no registra salida",
  LATE_ARRIVAL: "Sin llegada registrada",
  DELAY_30: "Retraso de 30 min o más",
};

/** «La cuidadora informó un retraso de unos 15 minutos (tráfico).» — declared, not an ETA. */
export const delaySentence = (d: { minutes: number; reason: DelayReason }) =>
  `La cuidadora informó un retraso de unos ${d.minutes}${d.minutes === 60 ? " o más" : ""} minutos (${DELAY_REASON_TEXT[d.reason].toLowerCase()}).`;

export const JOURNEY_ERROR_TEXT: Record<string, string> = {
  JOURNEY_OUTSIDE_WINDOW: "Solo puedes avisar desde 2 horas antes hasta 1 hora después del inicio.",
  JOURNEY_ASSIGNMENT_NOT_ACCEPTED: "Primero acepta el turno.",
  JOURNEY_SHIFT_NOT_ACTIVE: "Este turno ya no está activo.",
  JOURNEY_ALREADY_ARRIVED: "Tu llegada ya está registrada.",
  JOURNEY_DELAY_UNCHANGED: "Ese retraso ya estaba informado.",
  JOURNEY_DELAY_LIMIT: "Ya informaste tres retrasos. Si cambia algo, llama a la agencia.",
  JOURNEY_TIME_INVALID: "La hora del teléfono no es válida. Revisa la hora e inténtalo otra vez.",
};
