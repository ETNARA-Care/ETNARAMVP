import type { ApiError } from "@/api/client";

/**
 * Mensajes diferenciados por status/código -- exactamente los del brief
 * de Fase 3. El backend no manda texto legible (solo `{ error: "CODE" }`),
 * así que el texto en español vive aquí, no en el cliente HTTP.
 */
export function loginErrorMessage(err: ApiError): string {
  if (err.isNetworkError || err.status === 0) {
    return "No pudimos conectar con ETNARA. Verifica tu conexión.";
  }
  if (err.status === 401) {
    return "Correo/teléfono o contraseña incorrectos.";
  }
  if (err.status === 403) {
    return "No tienes acceso a esta cuenta.";
  }
  if (err.status >= 500) {
    return "ETNARA no está disponible en este momento.";
  }
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

export function bootstrapErrorMessage(err: ApiError): string {
  if (err.isNetworkError || err.status === 0) {
    return "No pudimos conectar con ETNARA. Verifica tu conexión.";
  }
  if (err.status >= 500) {
    return "ETNARA no está disponible en este momento.";
  }
  return "No pudimos recuperar tu sesión. Intenta iniciar sesión de nuevo.";
}
