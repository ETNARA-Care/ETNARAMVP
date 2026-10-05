import type { AdminCareEvent } from "@/features/agency/useAgencySupervision";
import { recipientName } from "@/api/shifts";
import { EmptyState } from "@/components/ui";
import { AdminPanel, AdminPanelHeader } from "@/components/admin/AdminUI";
import { timeFmt } from "./overviewModel";

const eventLabel: Record<string, string> = {
 MEAL: "Comida registrada", HYDRATION: "Hidratación registrada", TOILETING: "Asistencia al baño",
 MOBILITY: "Movilidad registrada", ACTIVITY: "Actividad registrada", MOOD: "Estado de ánimo", NOTE: "Nota de cuidado",
};
function eventDetail(event: AdminCareEvent) {
 if (event.note_text) return event.note_text;
 if (!event.structured_data || typeof event.structured_data !== "object") return null;
 const d = event.structured_data as Record<string, unknown>;
 const value = d.label ?? d.mealType ?? d.amount ?? d.result ?? d.activity ?? d.mood;
 return typeof value === "string" ? value : null;
}

export function ActivityFeed({ events, className = "" }: { events: AdminCareEvent[]; className?: string }) {
 const recent = [...events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 6);
 return (
 <AdminPanel className={className}>
 <AdminPanelHeader title="Actividad reciente" description="Registros de cuidado de hoy" />
 {recent.length ? (
 <ul className="px-5 pb-4 pt-2 sm:px-6">
 {recent.map((e) => {
 const detail = eventDetail(e);
 const who = e.caregiver?.display_name;
 return (
 <li key={e.id} className="border-b border-[var(--color-border)] py-3 last:border-0">
 <p className="text-sm text-[var(--color-text-secondary)]"><span className="font-medium text-[var(--color-text-primary)]">{eventLabel[e.type_code] ?? "Registro de cuidado"}</span>{e.recipient ? ` para ${recipientName(e.recipient)}` : ""}</p>
 {detail && <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{detail}</p>}
 <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{timeFmt(e.occurred_at)}{who ? `, ${who}` : ""}</p>
 </li>
 );
 })}
 </ul>
 ) : <div className="p-5"><EmptyState title="Sin actividad hoy" description="Los registros de cuidado aparecerán aquí a medida que el personal los documente." /></div>}
 </AdminPanel>
 );
}
