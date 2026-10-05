import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getEstablishmentWorkspace, listEstablishments, type Establishment } from "@/api/establishments";
import { listResidentDocuments, type ResidentDocument } from "@/api/residentDocuments";

/* Lógica de expedientes de residentes compartida por el Centro de Cumplimiento y el Resumen.
 Movida sin cambios desde AgencyComplianceCenterPage. */
export const REQUIRED_RESIDENT_DOCUMENTS = ["Expediente de ingreso", "Evaluación médica", "Evaluación dental", "Consentimiento", "Identificación"] as const;

export type ResidentCompliance = {
 establishmentId: string; residentId: string; residentName: string;
 completed: number; missing: string[]; expired: ResidentDocument[]; expiring: ResidentDocument[];
};

const normalized = (v: string) => v.trim().toLocaleLowerCase("es-PR");

export function documentState(documents: ResidentDocument[]) {
 const now = new Date(), soon = new Date(now);
 soon.setDate(soon.getDate() + 30);
 const expired = documents.filter((d) => d.expires_on && new Date(`${d.expires_on}T23:59:59`) < now);
 const expiring = documents.filter((d) => {
 if (!d.expires_on) return false;
 const date = new Date(`${d.expires_on}T23:59:59`);
 return date >= now && date <= soon;
 });
 const valid = new Set(documents.filter((d) => !d.expires_on || new Date(`${d.expires_on}T23:59:59`) >= now).map((d) => normalized(d.document_type)));
 const missing = REQUIRED_RESIDENT_DOCUMENTS.filter((r) => !valid.has(normalized(r)));
 return { expired, expiring, missing, completed: REQUIRED_RESIDENT_DOCUMENTS.length - missing.length };
}

export function useResidentCompliance() {
 const { activeOrganization } = useAuth();
 const organizationId = activeOrganization?.id;
 const [places, setPlaces] = useState<Establishment[]>([]);
 const [rows, setRows] = useState<ResidentCompliance[] | null>(null);
 const [error, setError] = useState(false);

 const load = useCallback(async () => {
 const token = getToken();
 if (!organizationId || !token) return;
 try {
 const response = await listEstablishments(organizationId, token);
 const active = response.establishments.filter((e) => e.status === "active");
 setPlaces(active);
 setRows((await Promise.all(active.map(async (e) => {
 const workspace = await getEstablishmentWorkspace(organizationId, e.id, token);
 return Promise.all(workspace.residents.filter((x) => x.status === "active").map(async (x) => {
 const documents = await listResidentDocuments(organizationId, e.id, x.id, token);
 return { establishmentId: e.id, residentId: x.id, residentName: `${x.first_name} ${x.last_name}`.trim(), ...documentState(documents.documents) };
 }));
 }))).flat());
 setError(false);
 } catch {
 setRows([]);
 setError(true);
 }
 }, [organizationId]);

 useEffect(() => {
 const task = window.setTimeout(() => void load(), 0);
 return () => window.clearTimeout(task);
 }, [load]);
 return { places, rows, error, reload: load };
}
