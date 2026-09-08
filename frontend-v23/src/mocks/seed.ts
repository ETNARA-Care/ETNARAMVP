import type { DemoState } from "./types";

/**
 * Semilla del escenario obligatorio de aceptación:
 * - Carmen Rivera: turno de hoy 8:00 AM – 4:00 PM, SIN CUBRIR.
 * - María Rivera: cuidadora disponible, sin turno asignado todavía.
 * - Ana Rivera: familiar de Carmen.
 * - Rafael (admin de agencia): sin entidad propia, es la identidad de Agencia.
 *
 * Se agregan un par de residentes/cuidadores/turnos adicionales (ya
 * asignados o completados) únicamente para que las vistas de "próximos
 * turnos", "turnos completados" y "cuidadores disponibles" no se vean
 * vacías -- no son parte del guion obligatorio, pero validan esos puntos
 * de la lista de verificación.
 */
export const DEMO_IDENTITIES = {
  agencyAdminId: "admin-rafael",
  agencyAdminName: "Rafael Vega",
  caregiverId: "w-maria",
  familyMemberId: "fam-ana",
};

const today = new Date().toISOString().slice(0, 10);
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoAt(dateStr: string, hour: number, minute = 0) {
  return `${dateStr}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export const seedDemoState: DemoState = {
  residents: [
    { id: "res-carmen", name: "Carmen Rivera" },
    { id: "res-jose", name: "José Manuel Ortiz" },
  ],
  familyMembers: [
    { id: "fam-ana", name: "Ana Rivera", residentId: "res-carmen" },
  ],
  workers: [
    { id: "w-maria", name: "María Rivera", available: true, credentialStatus: "active" },
    { id: "w-luis", name: "Luis Fernández", available: true, credentialStatus: "expiring" },
    { id: "w-carla", name: "Carla Núñez", available: false, credentialStatus: "active" },
  ],
  shifts: [
    {
      id: "shift-carmen-today",
      residentId: "res-carmen",
      workerId: null,
      date: today,
      start: "8:00 AM",
      end: "4:00 PM",
      status: "unassigned",
    },
    {
      id: "shift-carmen-yesterday",
      residentId: "res-carmen",
      workerId: "w-maria",
      date: daysAgo(1),
      start: "8:00 AM",
      end: "4:00 PM",
      status: "completed",
      checkInAt: isoAt(daysAgo(1), 8, 3),
      checkOutAt: isoAt(daysAgo(1), 16, 6),
    },
    {
      id: "shift-carmen-2days",
      residentId: "res-carmen",
      workerId: "w-luis",
      date: daysAgo(2),
      start: "8:00 AM",
      end: "4:00 PM",
      status: "completed",
      checkInAt: isoAt(daysAgo(2), 8, 1),
      checkOutAt: isoAt(daysAgo(2), 16, 2),
    },
    {
      id: "shift-jose-yesterday",
      residentId: "res-jose",
      workerId: "w-carla",
      date: daysAgo(1),
      start: "8:00 AM",
      end: "4:00 PM",
      status: "completed",
      checkInAt: isoAt(daysAgo(1), 8, 2),
      checkOutAt: isoAt(daysAgo(1), 16, 5),
    },
    {
      id: "shift-jose-tomorrow",
      residentId: "res-jose",
      workerId: "w-luis",
      date: "2026-08-24",
      start: "8:00 AM",
      end: "4:00 PM",
      status: "assigned",
    },
  ],
  careEvents: [
    // shift-carmen-yesterday: día completo, con observación (para poder ver
    // el resumen humano y el detalle del timeline en Historial)
    { id: "ce-y1", shiftId: "shift-carmen-yesterday", type: "check_in", createdAt: isoAt(daysAgo(1), 8, 3) },
    { id: "ce-y2", shiftId: "shift-carmen-yesterday", type: "meal", mealSubtype: "breakfast", mealPercent: 80, createdAt: isoAt(daysAgo(1), 8, 35) },
    { id: "ce-y3", shiftId: "shift-carmen-yesterday", type: "mood", mood: "calm", createdAt: isoAt(daysAgo(1), 10, 15) },
    { id: "ce-y4", shiftId: "shift-carmen-yesterday", type: "observation", note: "Un poco más cansada que de costumbre, nada preocupante.", createdAt: isoAt(daysAgo(1), 14, 0) },
    { id: "ce-y5", shiftId: "shift-carmen-yesterday", type: "check_out", createdAt: isoAt(daysAgo(1), 16, 6) },
    // shift-carmen-2days: día tranquilo, sin observaciones
    { id: "ce-2d1", shiftId: "shift-carmen-2days", type: "check_in", createdAt: isoAt(daysAgo(2), 8, 1) },
    { id: "ce-2d2", shiftId: "shift-carmen-2days", type: "meal", mealSubtype: "lunch", mealPercent: 90, createdAt: isoAt(daysAgo(2), 12, 10) },
    { id: "ce-2d3", shiftId: "shift-carmen-2days", type: "mood", mood: "happy", createdAt: isoAt(daysAgo(2), 15, 0) },
    { id: "ce-2d4", shiftId: "shift-carmen-2days", type: "check_out", createdAt: isoAt(daysAgo(2), 16, 2) },
  ],
  conversations: [
    {
      id: "conv-ana-caregiver",
      kind: "caregiver",
      residentId: "res-carmen",
      title: "Cuidadora de Carmen",
      participantIds: ["fam-ana", "w-maria"],
    },
    {
      id: "conv-ana-admin",
      kind: "admin",
      residentId: "res-carmen",
      title: "Administración",
      participantIds: ["fam-ana", "admin-rafael"],
    },
  ],
  messages: [],
  notifications: [],
};
