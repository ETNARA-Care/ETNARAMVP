/** 163 · Reglas de presentación del interruptor de modalidad (puras; las prueban los tests del portal). */
export const MODALITY_REASON_MIN = 10;
export const MODALITY_REASON_MAX = 1000;

export interface ModalitySwitchState { enabled: boolean; activationAllowed: boolean }

/** ¿Se puede pulsar el interruptor? Apagar siempre; encender solo con la autorización del servidor. */
export function switchAvailable(m: ModalitySwitchState): boolean {
  return m.enabled || m.activationAllowed;
}

export function reasonValid(reason: string): boolean {
  const n = reason.trim().length;
  return n >= MODALITY_REASON_MIN && n <= MODALITY_REASON_MAX;
}

export function modalityErrorMessage(code: string | undefined): string {
  switch (code) {
    case "MODALITY_ACTIVATION_NOT_AUTHORIZED": return "La activación todavía no está autorizada en el servidor. Apagar sigue disponible.";
    case "PLATFORM_ADMIN_REQUIRED": return "Solo la administración de ETNARA Central puede cambiar este interruptor.";
    case "INVALID_PAYLOAD":
    case "MODALITY_REASON_REQUIRED": return `Escribe un motivo de al menos ${MODALITY_REASON_MIN} caracteres.`;
    default: return "No se pudo guardar el cambio.";
  }
}

export function stateNote(m: ModalitySwitchState): string {
  if (m.enabled) return "Encendida: se pueden registrar nuevos cuidadores independientes.";
  return m.activationAllowed
    ? "Apagada: no se registran nuevos cuidadores independientes."
    : "Apagada: no se registran nuevos cuidadores independientes. La activación requiere autorización expresa en el servidor.";
}
