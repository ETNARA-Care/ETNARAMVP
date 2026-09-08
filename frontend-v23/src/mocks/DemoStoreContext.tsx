import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { DemoState, DemoCareEvent, ShiftStatus, DemoNotification } from "./types";
import { seedDemoState, DEMO_IDENTITIES } from "./seed";

/**
 * ⚠️ DemoStore -- src/mocks/
 *
 * ÚNICA fuente de verdad para los datos de simulación. Familiar, Cuidador
 * y Agencia leen y escriben este mismo estado -- por eso una asignación
 * hecha en Agencia aparece de inmediato en Cuidador, y un evento de
 * cuidado registrado por el cuidador aparece transformado en Familiar.
 *
 * Deliberadamente separado de la futura capa `src/api/`: esto es
 * React Context + useReducer en memoria, sin red, sin persistencia. Nada
 * de este archivo debe sobrevivir intacto una vez se conecte el backend
 * real en Fase 3+ -- en ese punto los mismos hooks (useShiftsForWorker,
 * useTimelineForShift, etc.) se reimplementan sobre TanStack Query.
 */

type Action =
  | { type: "ASSIGN_SHIFT"; shiftId: string; workerId: string }
  | { type: "CHECK_IN"; shiftId: string }
  | { type: "CHECK_OUT"; shiftId: string }
  | { type: "ADD_CARE_EVENT"; event: DemoCareEvent }
  | { type: "SEND_MESSAGE"; conversationId: string; senderId: string; senderName: string; text: string }
  | { type: "MARK_NOTIFICATION_READ"; notificationId: string };

/**
 * Crea una notificación de demo. Nunca lanza si falta un dato relacionado
 * (residente/cuidador/familiar no encontrado) -- en ese caso simplemente
 * no genera la notificación, para que un dato de seed incompleto no rompa
 * ninguna acción del usuario.
 */
function notify(state: DemoState, recipientId: string | undefined, message: string): DemoNotification[] {
  if (!recipientId) return state.notifications;
  const notification: DemoNotification = {
    id: crypto.randomUUID(),
    recipientId,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };
  return [...state.notifications, notification];
}

function familyMemberIdFor(state: DemoState, residentId: string) {
  return state.familyMembers.find((f) => f.residentId === residentId)?.id;
}

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "ASSIGN_SHIFT":
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === action.shiftId ? { ...s, workerId: action.workerId, status: "assigned" as ShiftStatus } : s
        ),
      };
    case "CHECK_IN": {
      const shift = state.shifts.find((s) => s.id === action.shiftId);
      const worker = state.workers.find((w) => w.id === shift?.workerId);
      const resident = state.residents.find((r) => r.id === shift?.residentId);
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === action.shiftId
            ? { ...s, status: "in_progress" as ShiftStatus, checkInAt: new Date().toISOString() }
            : s
        ),
        careEvents: [
          ...state.careEvents,
          { id: crypto.randomUUID(), shiftId: action.shiftId, type: "check_in", createdAt: new Date().toISOString() },
        ],
        notifications: resident && worker
          ? notify(state, familyMemberIdFor(state, resident.id), `${worker.name} inició el turno de ${resident.name.split(" ")[0]}.`)
          : state.notifications,
      };
    }
    case "CHECK_OUT": {
      const shift = state.shifts.find((s) => s.id === action.shiftId);
      const resident = state.residents.find((r) => r.id === shift?.residentId);
      return {
        ...state,
        shifts: state.shifts.map((s) =>
          s.id === action.shiftId
            ? { ...s, status: "completed" as ShiftStatus, checkOutAt: new Date().toISOString() }
            : s
        ),
        careEvents: [
          ...state.careEvents,
          { id: crypto.randomUUID(), shiftId: action.shiftId, type: "check_out", createdAt: new Date().toISOString() },
        ],
        notifications: resident
          ? notify(state, familyMemberIdFor(state, resident.id), `El turno de ${resident.name.split(" ")[0]} fue completado.`)
          : state.notifications,
      };
    }
    case "ADD_CARE_EVENT": {
      const shift = state.shifts.find((s) => s.id === action.event.shiftId);
      const resident = state.residents.find((r) => r.id === shift?.residentId);
      let notifications = state.notifications;
      if (resident && action.event.type === "observation") {
        notifications = notify(state, familyMemberIdFor(state, resident.id), "Se registró una nueva observación.");
      } else if (resident && action.event.type === "incident") {
        notifications = notify(state, DEMO_IDENTITIES.agencyAdminId, `Incidente reportado para ${resident.name}.`);
      }
      return { ...state, careEvents: [...state.careEvents, action.event], notifications };
    }
    case "SEND_MESSAGE": {
      const conversation = state.conversations.find((c) => c.id === action.conversationId);
      let notifications = state.notifications;
      if (conversation) {
        for (const recipientId of conversation.participantIds) {
          if (recipientId === action.senderId) continue;
          notifications = notify({ ...state, notifications }, recipientId, "Tienes un nuevo mensaje.");
        }
      }
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            conversationId: action.conversationId,
            senderId: action.senderId,
            senderName: action.senderName,
            text: action.text,
            createdAt: new Date().toISOString(),
          },
        ],
        notifications,
      };
    }
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.notificationId ? { ...n, read: true } : n)),
      };
    default:
      return state;
  }
}

interface DemoStoreValue {
  state: DemoState;
  assignShift: (shiftId: string, workerId: string) => void;
  checkIn: (shiftId: string) => void;
  checkOut: (shiftId: string) => void;
  addCareEvent: (event: Omit<DemoCareEvent, "id" | "createdAt">) => void;
  sendMessage: (conversationId: string, senderId: string, senderName: string, text: string) => void;
  markNotificationRead: (notificationId: string) => void;
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, seedDemoState);

  const value = useMemo<DemoStoreValue>(
    () => ({
      state,
      assignShift: (shiftId, workerId) => dispatch({ type: "ASSIGN_SHIFT", shiftId, workerId }),
      checkIn: (shiftId) => dispatch({ type: "CHECK_IN", shiftId }),
      checkOut: (shiftId) => dispatch({ type: "CHECK_OUT", shiftId }),
      addCareEvent: (event) =>
        dispatch({ type: "ADD_CARE_EVENT", event: { ...event, id: crypto.randomUUID(), createdAt: new Date().toISOString() } }),
      sendMessage: (conversationId, senderId, senderName, text) =>
        dispatch({ type: "SEND_MESSAGE", conversationId, senderId, senderName, text }),
      markNotificationRead: (notificationId) => dispatch({ type: "MARK_NOTIFICATION_READ", notificationId }),
    }),
    [state]
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

function useDemoStore() {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) throw new Error("useDemoStore debe usarse dentro de <DemoStoreProvider>");
  return ctx;
}

/* ---------------------------- Selectores ---------------------------- */

export function useResidents() {
  return useDemoStore().state.residents;
}

export function useResident(residentId: string | undefined) {
  const residents = useResidents();
  return residents.find((r) => r.id === residentId);
}

export function useWorkers() {
  return useDemoStore().state.workers;
}

export function useAvailableWorkers() {
  return useWorkers().filter((w) => w.available);
}

export function useAllShifts() {
  return useDemoStore().state.shifts;
}

export function useShift(shiftId: string | undefined) {
  return useAllShifts().find((s) => s.id === shiftId);
}

export function useUnassignedShifts() {
  return useAllShifts().filter((s) => s.status === "unassigned");
}

export function useShiftsForWorker(workerId: string) {
  return useAllShifts().filter((s) => s.workerId === workerId);
}

export function useShiftsForResident(residentId: string) {
  return useAllShifts().filter((s) => s.residentId === residentId);
}

export function useCareEventsForShift(shiftId: string) {
  return useDemoStore()
    .state.careEvents.filter((e) => e.shiftId === shiftId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function useRecentCareEvents(limit = 5) {
  return useDemoStore()
    .state.careEvents.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function useIncidents() {
  return useDemoStore().state.careEvents.filter((e) => e.type === "incident");
}

export function useConversationsForResident(residentId: string) {
  return useDemoStore().state.conversations.filter((c) => c.residentId === residentId);
}

export function useConversationsForParticipant(participantId: string) {
  return useDemoStore().state.conversations.filter((c) => c.participantIds.includes(participantId));
}

export function useConversation(conversationId: string | undefined) {
  return useDemoStore().state.conversations.find((c) => c.id === conversationId);
}

export function useMessagesForConversation(conversationId: string) {
  return useDemoStore()
    .state.messages.filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function useUnreadConversationCount(participantId: string) {
  // Simplificación de demo: "no leído" = conversaciones donde el último
  // mensaje no fue enviado por este participante. No hay persistencia de
  // "leído/no leído" real todavía -- eso requiere backend.
  const convos = useConversationsForParticipant(participantId);
  const { state } = useDemoStore();
  return convos.filter((c) => {
    const msgs = state.messages.filter((m) => m.conversationId === c.id);
    const last = msgs[msgs.length - 1];
    return last && last.senderId !== participantId;
  }).length;
}

/* ----------------------------- Acciones ------------------------------ */

export function useAssignShift() {
  return useDemoStore().assignShift;
}
export function useCheckIn() {
  return useDemoStore().checkIn;
}
export function useCheckOut() {
  return useDemoStore().checkOut;
}
export function useAddCareEvent() {
  return useDemoStore().addCareEvent;
}
export function useSendMessage() {
  return useDemoStore().sendMessage;
}

/* -------------------------- Notificaciones ---------------------------- */

export function useNotificationsForParticipant(participantId: string) {
  return useDemoStore()
    .state.notifications.filter((n) => n.recipientId === participantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function useUnreadNotificationCount(participantId: string) {
  return useNotificationsForParticipant(participantId).filter((n) => !n.read).length;
}

export function useMarkNotificationRead() {
  return useDemoStore().markNotificationRead;
}

/* ----------------------------- Historial ------------------------------- */

/** Turnos completados de un residente, más recientes primero -- para Historial. */
export function useCompletedShiftsForResident(residentId: string) {
  return useShiftsForResident(residentId)
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));
}
