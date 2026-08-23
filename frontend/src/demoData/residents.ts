export interface DemoResident {
  id: string;
  name: string;
  age: number;
  room?: string;
  avatarInitials: string;
  avatarColor: string;
  status: "active_care" | "shift_completed" | "upcoming";
  statusDetail: string;
  currentCaregiverId?: string;
  lastUpdate: string;
}

export const demoResidents: DemoResident[] = [
  {
    id: "res-carmen",
    name: "Carmen Rivera Demo",
    age: 82,
    room: "Habitación 104",
    avatarInitials: "CR",
    avatarColor: "#e7cf9f",
    status: "active_care",
    statusDetail: "Cuidado activo — María López Demo",
    currentCaregiverId: "cg-maria",
    lastUpdate: "2:14 PM",
  },
  {
    id: "res-jose",
    name: "José Méndez Demo",
    age: 79,
    room: "Habitación 108",
    avatarInitials: "JM",
    avatarColor: "#bcd4c7",
    status: "shift_completed",
    statusDetail: "Turno completado",
    lastUpdate: "1:40 PM",
  },
  {
    id: "res-elena",
    name: "Elena Cruz Demo",
    age: 85,
    room: "Habitación 112",
    avatarInitials: "EC",
    avatarColor: "#e3c2b8",
    status: "upcoming",
    statusDetail: "Próxima visita 3:00 PM",
    lastUpdate: "11:05 AM",
  },
];

export const getResidentById = (id: string) =>
  demoResidents.find((r) => r.id === id);
