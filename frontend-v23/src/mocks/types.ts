/**
 * ⚠️ TIPOS DE SIMULACIÓN -- src/mocks/
 *
 * Estos tipos describen el ÚNICO modelo mock compartido entre Familiar,
 * Cuidador y Agencia (DemoStore). Son deliberadamente más simples que los
 * contratos reales del backend (ver Fase 1) y NO deben confundirse con
 * ellos: nada de aquí es un endpoint inventado, es solo el estado en
 * memoria que permite validar el flujo UX de punta a punta antes de
 * conectar la API real en Fase 3.
 */

export type ShiftStatus = "unassigned" | "assigned" | "in_progress" | "completed";

export interface DemoResident {
  id: string;
  name: string;
}

export interface DemoFamilyMember {
  id: string;
  name: string;
  residentId: string; // a quién sigue esta persona -- simplificado a 1:1 para el escenario
}

export interface DemoWorker {
  id: string;
  name: string;
  available: boolean;
  credentialStatus: "active" | "expiring" | "expired";
}

export interface DemoShift {
  id: string;
  residentId: string;
  workerId: string | null;
  date: string; // YYYY-MM-DD
  start: string; // "8:00 AM"
  end: string; // "4:00 PM"
  status: ShiftStatus;
  checkInAt?: string;
  checkOutAt?: string;
}

export type CareEventType =
  | "check_in" | "check_out" | "meal" | "water" | "mobility" | "mood" | "observation" | "incident";

export interface DemoCareEvent {
  id: string;
  shiftId: string;
  type: CareEventType;
  createdAt: string; // ISO
  note?: string;
  // Campos específicos por tipo, todos opcionales -- ver AddCareEventSheet
  mealSubtype?: "breakfast" | "lunch" | "dinner";
  mealPercent?: number;
  mood?: "calm" | "happy" | "agitated" | "sad";
  incidentSeverity?: "low" | "medium" | "high" | "critical";
  incidentType?: string;
}

export type ConversationKind = "caregiver" | "admin";

export interface DemoConversation {
  id: string;
  kind: ConversationKind;
  residentId: string;
  title: string;
  participantIds: string[]; // ids de personas que pueden escribir (worker/family/admin)
}

export interface DemoMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface DemoNotification {
  id: string;
  recipientId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface DemoState {
  residents: DemoResident[];
  familyMembers: DemoFamilyMember[];
  workers: DemoWorker[];
  shifts: DemoShift[];
  careEvents: DemoCareEvent[];
  conversations: DemoConversation[];
  messages: DemoMessage[];
  notifications: DemoNotification[];
}
