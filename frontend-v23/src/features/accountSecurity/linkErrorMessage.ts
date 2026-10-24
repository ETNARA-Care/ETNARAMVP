import type { ApiError } from "@/api/client";

export function linkErrorMessage(error: unknown): string {
  const e = error as ApiError;
  if (e?.status === 0) return "No hay conexión. Inténtalo de nuevo.";
  if (e?.code === "PHONE_INVALID") return "Escribe un número válido de Puerto Rico o Estados Unidos.";
  if (e?.code === "PHONE_ALREADY_VERIFIED") return "Ese número ya está vinculado a tu cuenta.";
  if (e?.code === "PHONE_UNAVAILABLE") return "Ese número no se puede vincular a esta cuenta. Usa otro número.";
  if (e?.code === "SMS_RATE_LIMITED" || e?.status === 429) return "Pediste varios códigos seguidos. Espera unos minutos y vuelve a intentarlo.";
  if (e?.code === "CODE_INVALID") return "Código incorrecto o vencido. Revisa el mensaje o pide uno nuevo.";
  if (e?.code === "SMS_UNAVAILABLE") return "No pudimos enviar el mensaje ahora. Inténtalo en unos minutos.";
  if (e?.code === "INVALID_CREDENTIALS") return "La contraseña no es correcta.";
  if (e?.code === "FEATURE_NOT_ENABLED") return "La verificación por SMS aún no está disponible.";
  return "No pudimos completar el paso. Inténtalo de nuevo.";
}
