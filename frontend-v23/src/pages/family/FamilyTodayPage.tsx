import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Clock3, ShieldCheck } from "lucide-react";
import { Badge, Avatar, ErrorState, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyRecipient, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";

function isToday(iso: string) {
  const value = new Date(iso); const today = new Date();
  return value.toDateString() === today.toDateString();
}
function recipientName(recipient: FamilyRecipient | null) {
  if (!recipient) return "Tu familiar";
  return recipient.preferredName || `${recipient.firstName} ${recipient.lastName}`.trim();
}
function shiftStatus(shift?: FamilyShiftSummary) {
  if (!shift) return { tone: "warning" as const, label: "Sin turno hoy" };
  if (shift.checkedOutAt || shift.status === "completed") return { tone: "neutral" as const, label: "Completado" };
  if (shift.checkedInAt || shift.status === "in_progress") return { tone: "success" as const, label: "En curso" };
  if (shift.caregiver) return { tone: "success" as const, label: "Próximo" };
  return { tone: "warning" as const, label: "Sin asignar" };
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
}

export function FamilyTodayPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const [recipient, setRecipient] = useState<FamilyRecipient | null>(null);
  const [shifts, setShifts] = useState<FamilyShiftSummary[] | null>(null);
  const [timeline, setTimeline] = useState<FamilyTimelineItem[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    setError(false);
    try {
      const recipients = await listMyCareRecipients(token);
      const selected = activeOrganization ? recipients.find(x => x.organizationId === activeOrganization.id) ?? recipients[0] : recipients[0];
      if (!selected) { setRecipient(null); setShifts([]); setTimeline([]); return; }
      const [shiftRows, timelineRows] = await Promise.all([
        listFamilyShifts(selected.organizationId, selected.recipientId, token),
        getFamilyTimeline(selected.organizationId, selected.recipientId, token),
      ]);
      setRecipient(selected); setShifts(shiftRows); setTimeline(timelineRows);
    } catch { setError(true); setShifts([]); setTimeline([]); }
  }, [activeOrganization]);

  useEffect(() => {
    void load(); const interval = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load(); window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const shift = useMemo(() => shifts?.find(x => isToday(x.scheduledStart) && !x.checkedOutAt && x.status !== "cancelled")
    ?? shifts?.find(x => isToday(x.scheduledStart)), [shifts]);
  const entries = timeline.filter(x => isToday(x.occurredAt));
  const caredFor = recipientName(recipient);
  const caregiver = shift?.caregiver;
  const status = shiftStatus(shift);

  if (shifts === null) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm font-medium text-[#66845f]">Tu espacio de cuidado</p>
        <h1 className="mt-1 font-display text-[2rem] leading-tight text-[#102b57]">{caredFor}</h1>
        <p className="mt-1 text-sm text-[#667085]">
          {entries.length > 0 ? "Tienes nuevas actualizaciones de cuidado hoy." : "Te mantendremos al día con su cuidado."}
        </p>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#102b57] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8c9ad]">Hoy</p>
            <h2 className="mt-2 font-display text-2xl">{status.label === "En curso" ? "El cuidado está en curso" : status.label}</h2>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/8 p-3">
          <Avatar name={caregiver?.displayName ?? caredFor} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{caregiver?.displayName ?? "Aún sin cuidador asignado"}</p>
            {shift ? <p className="mt-0.5 text-xs text-white/70">{time(shift.scheduledStart)} – {time(shift.scheduledEnd)}</p>
              : <p className="mt-0.5 text-xs text-white/70">No hay un turno programado para hoy.</p>}
          </div>
          {caregiver?.credentials?.length ? <ShieldCheck size={18} className="text-[#b8c9ad]" aria-label="Profesional verificada" /> : null}
        </div>
      </section>

      <section className="rounded-[22px] border border-[#102b57]/10 bg-white p-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#66845f]">Actividad reciente</p>
            <h2 className="mt-1 font-display text-xl text-[#102b57]">Lo que ha ocurrido hoy</h2>
          </div>
          <button onClick={() => navigate("/family/activity")} className="flex items-center text-sm font-medium text-[#486d48]">Ver todo <ChevronRight size={17}/></button>
        </div>
        {entries.length ? <div className="divide-y divide-[#102b57]/8">
          {entries.slice(0, 4).map((item) => (
            <button key={item.id} onClick={() => navigate("/family/activity")} className="flex w-full gap-3 py-3 text-left">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef3e9] text-[#66845f]"><Clock3 size={15}/></div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3"><p className="font-medium text-[#173154]">{item.title}</p><span className="shrink-0 text-xs text-[#98a2b3]">{time(item.occurredAt)}</span></div>
                <p className="mt-0.5 line-clamp-2 text-sm text-[#667085]">{item.summary}</p>
              </div>
            </button>
          ))}
        </div> : <div className="rounded-2xl bg-[#f8f5ee] p-4 text-sm text-[#667085]">Todavía no hay actividad registrada hoy.</div>}
      </section>

      <button onClick={() => navigate("/family/history")} className="flex w-full items-center justify-between rounded-[20px] border border-[#102b57]/10 bg-[#f1eee6] px-4 py-3 text-left">
        <div><p className="font-medium text-[#173154]">Próximos turnos</p><p className="text-sm text-[#667085]">Consulta el calendario de cuidado.</p></div>
        <ChevronRight size={20} className="text-[#66845f]"/>
      </button>
    </div>
  );
}
