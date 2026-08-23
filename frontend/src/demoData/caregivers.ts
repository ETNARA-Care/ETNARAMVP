export type CredentialStatus = "verified" | "expiring" | "action_required";

export interface DemoCredential {
  label: string;
  status: CredentialStatus;
  detail?: string;
}

export interface DemoCaregiver {
  id: string;
  name: string;
  role: string;
  avatarInitials: string;
  avatarColor: string;
  verified: boolean;
  yearsExperience: number;
  languages: string[];
  bio: string;
  lastReview: string;
  credentials: DemoCredential[];
}

export const demoCaregivers: DemoCaregiver[] = [
  {
    id: "cg-maria",
    name: "María López Demo",
    role: "Cuidadora Certificada",
    avatarInitials: "ML",
    avatarColor: "#cfe0d6",
    verified: true,
    yearsExperience: 7,
    languages: ["Español", "Inglés"],
    bio: "María se especializa en el cuidado de adultos mayores con movilidad reducida. Le apasiona crear rutinas que combinan bienestar físico y compañía genuina.",
    lastReview: "Julio 2026",
    credentials: [
      { label: "Identidad verificada", status: "verified" },
      { label: "Background Check revisado", status: "verified" },
      { label: "Ley 300 vigente", status: "verified" },
      { label: "CPR vigente", status: "verified" },
      { label: "BLS vigente", status: "verified" },
      { label: "Capacitación interna completada", status: "verified" },
    ],
  },
  {
    id: "cg-pedro",
    name: "Pedro Santos Demo",
    role: "Cuidador",
    avatarInitials: "PS",
    avatarColor: "#e0d3c2",
    verified: false,
    yearsExperience: 2,
    languages: ["Español"],
    bio: "Pedro está completando su proceso de verificación antes de recibir asignaciones activas.",
    lastReview: "Pendiente",
    credentials: [
      { label: "Identidad verificada", status: "verified" },
      { label: "Background Check revisado", status: "action_required" },
      { label: "Ley 300 vigente", status: "action_required" },
      { label: "CPR vigente", status: "verified" },
      { label: "BLS vigente", status: "action_required" },
      { label: "Capacitación interna completada", status: "action_required" },
    ],
  },
  {
    id: "cg-laura",
    name: "Laura Méndez Demo",
    role: "Enfermera Práctica",
    avatarInitials: "LM",
    avatarColor: "#d9cbe0",
    verified: true,
    yearsExperience: 11,
    languages: ["Español", "Inglés", "Portugués"],
    bio: "Laura aporta experiencia clínica al equipo, con enfoque en pacientes con condiciones crónicas.",
    lastReview: "Junio 2026",
    credentials: [
      { label: "Identidad verificada", status: "verified" },
      { label: "Background Check revisado", status: "verified" },
      { label: "Ley 300 vigente", status: "verified" },
      { label: "CPR vigente", status: "expiring", detail: "Vence en 12 días" },
      { label: "BLS vigente", status: "verified" },
      { label: "Capacitación interna completada", status: "verified" },
    ],
  },
];

export const getCaregiverById = (id: string) =>
  demoCaregivers.find((c) => c.id === id);
