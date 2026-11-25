/**
 * Fase 1 (25-nov-2026): textos según el tipo de organización. En una práctica independiente («Cuidador
 * independiente», una sola persona) no hay «agencia»: la misma persona administra y presta el servicio, y la
 * familia trata directamente con ella. Las agencias y los hogares conservan exactamente sus textos.
 * Puro: lo prueban los tests del portal.
 */

/** Familia: botón para escribir cuando hoy no hay turno. */
export function familyWriteText(independent: boolean): string {
  return independent ? "Escríbele a tu cuidador(a)" : "Escríbele a la agencia";
}

/** Familia: hay turno pero todavía sin persona asignada. */
export function familyPendingCaregiverText(independent: boolean): string {
  return independent ? "Pendiente de confirmar la visita" : "La agencia está confirmando quién le atenderá";
}

/** Familia: dirección del servicio (quién la registra y revisa las correcciones). */
export function serviceLocationText(independent: boolean) {
  return independent
    ? {
        approved: "Aplicada por tu cuidador(a)",
        formError: "Escribe la corrección o un mensaje para tu cuidador(a).",
        sent: "Solicitud enviada. Tu cuidador(a) la revisará y te avisaremos.",
        marked: "Ubicación marcada por tu cuidador(a)",
        verified: "Verificada por tu cuidador(a)",
        notYet: "Tu cuidador(a) aún no ha registrado la dirección.",
        send: "Enviar a tu cuidador(a)",
        review: "Tu cuidador(a) revisará tu solicitud antes de cambiar la dirección oficial.",
        messageLabel: "Mensaje para tu cuidador(a)",
        keeps: "Tu cuidador(a) mantiene la dirección del servicio. Si ves un error, puedes pedir una corrección.",
      }
    : {
        approved: "Aplicada por la agencia",
        formError: "Escribe la corrección o un mensaje para la agencia.",
        sent: "Solicitud enviada. La agencia la revisará y te avisaremos.",
        marked: "Ubicación marcada por la agencia",
        verified: "Verificada por la agencia",
        notYet: "La agencia aún no ha registrado la dirección.",
        send: "Enviar a la agencia",
        review: "La agencia revisará tu solicitud antes de cambiar la dirección oficial.",
        messageLabel: "Mensaje para la agencia",
        keeps: "La agencia mantiene la dirección del servicio. Si ves un error, puedes pedir una corrección.",
      };
}

/** Cuidadora: avisos del detalle del turno. */
export function caregiverShiftText(independent: boolean) {
  return independent
    ? {
        cancelledTitle: "Se canceló esta visita",
        cancelledBody: "No tienes que ir.",
        cancelledToast: "Se canceló esta visita. No tienes que ir.",
        unassignedBody: "Este turno ya no está asignado a ti. No tienes que ir.",
        overdueBody: "Ya no se puede comenzar ni registrar la llegada.",
        outsideWindow: "Este turno ya terminó. No se puede comenzar.",
        arrivalWhat: "«Llegué» deja registrado que estás en el lugar del servicio y avisa a la familia. Es distinto de comenzar el turno.",
        arrivalSkip: "Si no puedes registrarlo ahora, puedes comenzar igual.",
      }
    : {
        cancelledTitle: "La agencia canceló esta visita",
        cancelledBody: "No tienes que ir. Si ya estabas en camino, comunícate con la agencia.",
        cancelledToast: "La agencia canceló esta visita. No tienes que ir.",
        unassignedBody: "La agencia cambió la persona asignada. No tienes que ir; si ya estabas en camino, comunícate con la agencia.",
        overdueBody: "Ya no se puede comenzar ni registrar la llegada. La agencia lo revisará. Si hiciste la visita, avísale para que la registre.",
        outsideWindow: "Este turno ya terminó. No se puede comenzar; avísale a la agencia.",
        arrivalWhat: "«Llegué» le confirma a la agencia que estás en el lugar del servicio. Es distinto de comenzar el turno.",
        arrivalSkip: "Si no puedes registrarlo ahora, puedes comenzar igual. La agencia verá que el turno inició sin «Llegué».",
      };
}
