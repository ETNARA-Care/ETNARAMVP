export interface DemoFamilyMember {
  id: string;
  name: string;
  relationship: string;
  canViewPhotos: boolean;
  canReceiveNotifications: boolean;
}

export const demoFamilyMembers: DemoFamilyMember[] = [
  {
    id: "fam-ana",
    name: "Ana Rivera Demo",
    relationship: "Hija",
    canViewPhotos: true,
    canReceiveNotifications: true,
  },
];

export type TimelineEventType =
  | "check_in"
  | "meal"
  | "hydration"
  | "activity"
  | "mood"
  | "photo"
  | "check_out"
  | "observation";

export interface DemoTimelineEvent {
  id: string;
  type: TimelineEventType;
  time: string;
  title: string;
  detail: string;
  worker?: string;
  hasPhoto?: boolean;
}

export const demoTimelineToday: DemoTimelineEvent[] = [
  {
    id: "evt-1",
    type: "check_in",
    time: "8:02 AM",
    title: "Check-in",
    detail: "María llegó y comenzó el turno.",
    worker: "María López Demo",
  },
  {
    id: "evt-2",
    type: "meal",
    time: "8:45 AM",
    title: "Desayuno",
    detail: "Consumió casi todo.",
  },
  {
    id: "evt-3",
    type: "hydration",
    time: "9:20 AM",
    title: "Hidratación",
    detail: "Tomó agua.",
  },
  {
    id: "evt-4",
    type: "activity",
    time: "10:15 AM",
    title: "Actividad",
    detail: "Caminata de 15 minutos.",
  },
  {
    id: "evt-5",
    type: "mood",
    time: "11:30 AM",
    title: "Estado de ánimo",
    detail: "Animada y conversadora.",
  },
  {
    id: "evt-6",
    type: "meal",
    time: "12:30 PM",
    title: "Almuerzo",
    detail: "Consumió aproximadamente 75%.",
  },
  {
    id: "evt-7",
    type: "photo",
    time: "2:00 PM",
    title: "Actividad con fotografía",
    detail: "Tarde de dominó en el jardín.",
    hasPhoto: true,
  },
  {
    id: "evt-8",
    type: "check_out",
    time: "4:55 PM",
    title: "Check-out",
    detail: "Turno completado.",
    worker: "María López Demo",
  },
];
