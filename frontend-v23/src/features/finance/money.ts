import type { FinanceUnit, HalfDayPolicy, Margin } from "@/api/finance";

/** Money is handled as integer cents end to end; text is parsed without floats. */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100).toLocaleString("es-PR");
  const rest = String(abs % 100).padStart(2, "0");
  return `${negative ? "−" : ""}$${dollars}.${rest}`;
}

/** "25", "25.5", "$1,025.00" → cents. Returns null when the text is not a valid amount. */
export function parseDollars(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export const UNIT_LABEL: Record<FinanceUnit, string> = { hour: "por hora", shift: "por turno", day: "por día", fixed: "precio fijo" };
export const UNIT_SHORT: Record<FinanceUnit, string> = { hour: "/h", shift: "/turno", day: "/día", fixed: "" };
export const UNIT_NAME: Record<FinanceUnit, string> = { hour: "Hora", shift: "Turno", day: "Día", fixed: "Precio fijo" };
export const UNIT_HELP: Record<FinanceUnit, string> = {
  hour: "Se cobra y se paga por minuto trabajado. Puedes fijar un mínimo y un redondeo.",
  shift: "Un cargo por turno completado, dure lo que dure.",
  day: "Un cargo por cada bloque de 24 horas. Un servicio de 24 h es 1 día, no 24 horas.",
  fixed: "Un cargo por servicio prestado, sin importar la duración (p. ej. transporte).",
};
export const HALF_DAY_LABEL: Record<HalfDayPolicy, string> = {
  review: "La agencia decide cada caso",
  proportional: "Proporcional a las horas",
  fixed: "Medio día con importe fijo (hasta 12 h)",
};

export function rateWithUnit(cents: number | null | undefined, unit: FinanceUnit): string {
  return cents === null || cents === undefined ? "Sin tarifa" : `${formatCents(cents)}${UNIT_SHORT[unit]}`;
}

export function formatMargin(margin: Margin | null | undefined): string {
  if (!margin) return "—";
  const pct = margin.marginBasisPoints === null ? "" : ` · ${(margin.marginBasisPoints / 100).toLocaleString("es-PR", { maximumFractionDigits: 1 })} %`;
  return `${formatCents(margin.differenceCents)}${pct}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "sin fecha de fin";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function hoursFromHundredths(hundredths: number | null | undefined): string {
  if (hundredths === null || hundredths === undefined) return "—";
  return (hundredths / 100).toLocaleString("es-PR", { maximumFractionDigits: 2 });
}

/** Text from the API error codes of Finanzas, in plain Spanish. */
export const FINANCE_ERROR: Record<string, string> = {
  FINANCE_RATE_REASON_REQUIRED: "Escribe el motivo del cambio de tarifa.",
  FINANCE_RATE_PAST_REPLACEMENT: "No se puede cambiar un precio que ya estaba vigente en el pasado. Elige hoy o una fecha futura.",
  FINANCE_RATE_LATER_VERSION_EXISTS: "Ya hay una tarifa programada para más adelante. Elige una fecha posterior a esa.",
  FINANCE_RATE_SAME_START: "Ya hay una tarifa que empieza ese mismo día.",
  FINANCE_RATE_OVERLAP: "Esa tarifa se solaparía con otra. Revisa las fechas.",
  FINANCE_RATE_END_INVALID: "La fecha de fin no puede quedar en el pasado.",
  FINANCE_RATE_END_ONLY_EARLIER: "Solo se puede adelantar el fin de una tarifa.",
  FINANCE_RATE_RULE_NOT_FOR_UNIT: "Esa regla no aplica a la unidad de este servicio.",
  FINANCE_HALF_DAY_AMOUNT_REQUIRED: "Indica el importe del medio día.",
  FINANCE_RATE_SCOPE_INVALID: "Revisa a quién aplica la tarifa.",
  FINANCE_SERVICE_INACTIVE: "Este servicio está desactivado. Actívalo primero.",
  FINANCE_DUPLICATE: "Ya existe un registro con ese nombre o fecha.",
  SHIFT_FINANCE_LOCKED: "Las horas de este turno ya están aprobadas: el servicio y el pagador no se pueden cambiar.",
  FINANCE_FORBIDDEN: "Solo el administrador de la agencia puede ver o cambiar Finanzas.",
  FEATURE_NOT_ENABLED: "Finanzas no está activado para esta agencia.",
  PAY_PERIOD_OVERLAP: "Ese periodo se solapa con otro ya cerrado: alguna hoja de tiempo ya está en otro periodo.",
};

export function financeErrorText(error: unknown, fallback = "No se pudo guardar. Inténtalo de nuevo."): string {
  const code = (error as { code?: string })?.code;
  return (code && FINANCE_ERROR[code]) || fallback;
}
