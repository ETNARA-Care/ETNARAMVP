import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ResidentCompliance } from "@/features/agency/useResidentCompliance";
import type { OperationalAlert } from "@/api/operations";
import { EmptyState, Skeleton } from "@/components/ui";
import { AdminPanel, AdminPanelHeader, SeverityBadge } from "@/components/admin/AdminUI";
import type { AdminSeverity } from "@/components/admin/severity";
import { dateFmt } from "./overviewModel";

type Row = { id: string; name: string; owner: string; ownerType: "Residente" | "Personal"; due: string; status: string; severity: AdminSeverity; href: string };

const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000);

/** Vencimientos reales: documentos de residentes (≤30 días o vencidos) + credenciales del personal con alerta. */
export function ExpiringDocuments({ rows, credentialAlerts, className = "" }: { rows: ResidentCompliance[] | null; credentialAlerts: OperationalAlert[]; className?: string }) {
 const navigate = useNavigate();
 const items: Row[] = [
 ...(rows ?? []).flatMap((r) => [...r.expired, ...r.expiring].map((d) => {
 const days = daysUntil(d.expires_on!);
 return { id: d.id, name: d.title || d.document_type, owner: r.residentName, ownerType: "Residente" as const, due: dateFmt(d.expires_on!),
 status: days < 0 ? `Vencido hace ${-days} ${-days === 1 ? "día" : "días"}` : `En ${days} ${days === 1 ? "día" : "días"}`,
 severity: (days < 0 || days <= 10 ? "critical" : days <= 21 ? "warning" : "info") as AdminSeverity, href: `/agency/residents/${r.residentId}`, sort: days };
 })).sort((a, b) => a.sort - b.sort),
 ...credentialAlerts.map((a) => ({ id: a.key, name: a.title, owner: a.detail, ownerType: "Personal" as const, due: "—", status: a.severity === "critical" ? "Urgente" : "Revisar", severity: a.severity as AdminSeverity, href: a.actionPath })),
 ];
 return (
 <AdminPanel className={className}>
 <AdminPanelHeader title="Documentos próximos a vencer" description="Expedientes de residentes y credenciales del personal." />
 {rows === null ? <div className="p-5 sm:p-6"><Skeleton className="h-40" /></div> : items.length === 0 ? (
 <div className="p-5 sm:p-6"><EmptyState title="Nada vence en los próximos 30 días" description="Los documentos vencidos o por vencer aparecerán aquí." /></div>
 ) : (<>
 <div className="mt-4 hidden overflow-x-auto md:block">
 <table className="w-full min-w-[620px] text-left text-sm">
 <thead><tr className="border-y border-[var(--color-border)] bg-[var(--color-ivory-100)]/60 text-xs text-[var(--color-text-muted)]">
 <th className="py-2.5 pl-6 font-normal">Documento</th><th className="py-2.5 font-normal">Pertenece a</th><th className="py-2.5 font-normal">Vence</th><th className="py-2.5 pr-6 text-right font-normal">Estado</th>
 </tr></thead>
 <tbody className="divide-y divide-[var(--color-border)]">
 {items.slice(0, 8).map((d) => (
 <tr key={d.id} onClick={() => navigate(d.href)} className="cursor-pointer hover:bg-[var(--color-ivory-100)]/70">
 <td className="py-3.5 pl-6"><span className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-text-primary)]/[0.04] text-[var(--color-text-secondary)]"><FileText size={16} aria-hidden /></span><span className="font-medium text-[var(--color-text-primary)]">{d.name}</span></span></td>
 <td className="py-3.5"><span className="text-[var(--color-text-secondary)]">{d.owner}</span> <span className="ml-1 whitespace-nowrap rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">{d.ownerType}</span></td>
 <td className="py-3.5 tabular-nums text-[var(--color-text-secondary)]">{d.due}</td>
 <td className="py-3.5 pr-6 text-right"><SeverityBadge severity={d.severity}>{d.status}</SeverityBadge></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <ul className="mt-4 divide-y divide-[var(--color-border)] border-t border-[var(--color-border)] md:hidden">
 {items.slice(0, 6).map((d) => (
 <li key={d.id}>
 <button type="button" onClick={() => navigate(d.href)} className="w-full px-5 py-3.5 text-left">
 <span className="flex items-start justify-between gap-3"><span className="min-w-0 text-sm font-medium text-[var(--color-text-primary)]">{d.name}</span><SeverityBadge severity={d.severity}>{d.status}</SeverityBadge></span>
 <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{d.owner}, {d.ownerType.toLowerCase()}</span>
 </button>
 </li>
 ))}
 </ul>
 <div className="h-2" />
 </>)}
 </AdminPanel>
 );
}
