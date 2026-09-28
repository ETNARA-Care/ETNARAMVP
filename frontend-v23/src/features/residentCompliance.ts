import type { ResidentDocument } from "@/api/residentDocuments";

export const residentRequirements = [
  "Expediente de ingreso",
  "Evaluación médica",
  "Evaluación dental",
  "Consentimiento",
  "Identificación",
] as const;

export type ComplianceState = "complete" | "incomplete" | "expiring" | "expired";
export interface ResidentCompliance {
  completed: number;
  total: number;
  percentage: number;
  missing: string[];
  expired: ResidentDocument[];
  expiring: ResidentDocument[];
  state: ComplianceState;
}

const day = 86_400_000;
export function calculateResidentCompliance(documents: ResidentDocument[], now = new Date()): ResidentCompliance {
  const active = documents;
  const missing = residentRequirements.filter(req => !active.some(doc => doc.document_type === req));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expired = active.filter(doc => doc.expires_on && new Date(`${doc.expires_on}T00:00:00`).getTime() < today);
  const expiring = active.filter(doc => {
    if (!doc.expires_on) return false;
    const delta = new Date(`${doc.expires_on}T00:00:00`).getTime() - today;
    return delta >= 0 && delta <= 30 * day;
  });
  const completed = residentRequirements.length - missing.length;
  const state: ComplianceState = expired.length ? "expired" : missing.length ? "incomplete" : expiring.length ? "expiring" : "complete";
  return { completed, total: residentRequirements.length, percentage: Math.round((completed / residentRequirements.length) * 100), missing: [...missing], expired, expiring, state };
}

export const complianceLabels: Record<ComplianceState,string> = {
  complete: "Expediente completo",
  incomplete: "Expediente incompleto",
  expiring: "Próximo a vencer",
  expired: "Documento vencido",
};
