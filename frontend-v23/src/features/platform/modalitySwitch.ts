/** 163 · Reglas de presentación del interruptor de modalidad (puras; las prueban los tests del portal). */
export const MODALITY_REASON_MIN = 10;
export const MODALITY_REASON_MAX = 1000;

export interface ModalitySwitchState { enabled: boolean; activationAllowed: boolean; databaseUnlocked: boolean }

/** ¿Se puede pulsar el interruptor? Apagar siempre; encender solo con la autorización del servidor Y la de la base. */
export function switchAvailable(m: ModalitySwitchState): boolean {
  return m.enabled || (m.activationAllowed && m.databaseUnlocked);
}

export function reasonValid(reason: string): boolean {
  const n = reason.trim().length;
  return n >= MODALITY_REASON_MIN && n <= MODALITY_REASON_MAX;
}

export function modalityErrorMessage(code: string | undefined): string {
  switch (code) {
    case "MODALITY_ACTIVATION_NOT_AUTHORIZED": return "La activación todavía no está autorizada en el servidor. Apagar sigue disponible.";
    case "MODALITY_ACTIVATION_LOCKED": return "El candado de la base de datos sigue cerrado: falta una autorización de activación vigente. Apagar sigue disponible.";
    case "PLATFORM_ADMIN_REQUIRED": return "Solo la administración de ETNARA Central puede cambiar este interruptor.";
    case "INVALID_PAYLOAD":
    case "MODALITY_REASON_REQUIRED": return `Escribe un motivo de al menos ${MODALITY_REASON_MIN} caracteres.`;
    default: return "No se pudo guardar el cambio.";
  }
}

export function stateNote(m: ModalitySwitchState): string {
  if (m.enabled) return "Encendida: se pueden registrar nuevos cuidadores independientes.";
  if (m.activationAllowed && m.databaseUnlocked) return "Apagada: no se registran nuevos cuidadores independientes. Las autorizaciones para encender están vigentes.";
  return "Apagada: no se registran nuevos cuidadores independientes. Encender requiere autorización expresa en el servidor y en la base de datos.";
}

/** Estado de las dos autorizaciones previas a Central (se muestran a la administración de plataforma). */
export function lockLines(m: ModalitySwitchState & { databaseUnlockedUntil?: string | null }): string[] {
  return [
    `Servidor: ${m.activationAllowed ? "autorizado" : "sin autorización"}`,
    `Base de datos: ${m.databaseUnlocked ? `autorización vigente${m.databaseUnlockedUntil ? ` hasta ${new Date(m.databaseUnlockedUntil).toLocaleString("es-PR")}` : ""}` : "candado cerrado"}`,
  ];
}
