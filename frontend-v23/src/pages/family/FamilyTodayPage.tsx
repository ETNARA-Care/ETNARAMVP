import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { Avatar, ErrorState, Skeleton } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getFamilyTimeline, listMyCareRecipients, type FamilyRecipient, type FamilyTimelineItem } from "@/api/familyTimeline";
import { listFamilyShifts, type FamilyShiftSummary } from "@/api/familyShifts";
import { pickRecipient, useFamilyRecipient } from "@/features/family/familyRecipient";
import { buildDailySummary } from "@/features/family/dailySummary";
import { FamilyJourneyProgress } from "@/features/journey/FamilyJourneyProgress";
import { STATE_TEXT } from "@/features/journey/journeyText";

function isToday(iso: string) {
  const value = new Date(iso); const today = new Date();
  return value.toDateString() === today.toDateString();
}
function recipientName(recipient: FamilyRecipient | null) {
  if (!recipient) return "Tu familiar";
  return recipient.preferredName || `${recipient.firstName} ${recipient.lastName}`.trim();
}
function shiftStatus(shift?: FamilyShiftSummary) {
  if (!shift) return { tone: "neutral" as const, label: "Sin turno hoy" };
  // Gate 7: the derived journey state (declared departure, arrival, start, finish).
  const j = shift.journey;
  if (j && !["UNASSIGNED", "PENDING_ACCEPTANCE"].includes(j.state)) return { tone: "success" as const, label: STATE_TEXT[j.state] };
  if (shift.checkedOutAt || shift.status === "completed") return { tone: "neutral" as const, label: "Completado" };
  if (shift.checkedInAt || shift.status === "in_progress") return { tone: "success" as const, label: "En curso" };
  if (shift.caregiver) return { tone: "success" as const, label: "Próximo" };
  return { tone: "neutral" as const, label: "Por confirmar" };
}
function headline(label: string) {
  if (label === "En curso" || label === "Servicio iniciado") return "El cuidado está en curso";
  if (label === "En camino") return "La cuidadora va en camino";
  if (label === "Llegada registrada") return "La cuidadora llegó";
  if (label === "Servicio finalizado") return "El servicio de hoy terminó";
  if (label === "Cuidadora asignada") return "Cuidadora confirmada";
  if (label === "Sin turno hoy") return "Hoy no hay turno";
  if (label === "Por confirmar") return "Turno por confirmar";
  return label;
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
}

export function FamilyTodayPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const { selectedKey } = useFamilyRecipient();
  const [recipient, setRecipient] = useState<FamilyRecipient | null>(null);
  const [shifts, setShifts] = useState<FamilyShiftSummary[] | null>(null);
  const [timeline, setTimeline] = useState<FamilyTimelineItem[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    setError(false);
    try {
      const recipients = await listMyCareRecipients(token);
      const selected = pickRecipient(recipients, activeOrganization?.id, selectedKey);
      if (!selected) { setRecipient(null); setShifts([]); setTimeline([]); return; }
      const [shiftRows, timelineRows] = await Promise.all([
        listFamilyShifts(selected.organizationId, selected.recipientId, token),
        getFamilyTimeline(selected.organizationId, selected.recipientId, token),
      ]);
      setRecipient(selected); setShifts(shiftRows); setTimeline(timelineRows);
    } catch { setError(true); setShifts([]); setTimeline([]); }
  }, [activeOrganization, selectedKey]);

  useEffect(() => {
    void load(); const interval = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load(); window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  const shift = useMemo(() => shifts?.find(x => isToday(x.scheduledStart) && !x.checkedOutAt && x.status !== "cancelled")
    ?? shifts?.find(x => isToday(x.scheduledStart)), [shifts]);
  const entries = timeline.filter(x => isToday(x.occurredAt));
  const lastEntry = entries[0];
  const summary = buildDailySummary(entries);
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
          {lastEntry ? `Última actualización: ${lastEntry.title.toLowerCase()} a las ${time(lastEntry.occurredAt)}` : "Te mantendremos al día con su cuidado."}
        </p>
      </section>

      <section className="overflow-hidden rounded-[24px] bg-[#102b57] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8c9ad]">Hoy</p>
            <h2 className="mt-2 font-display text-2xl">{headline(status.label)}</h2>
          </div>
          {shift && <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">{status.label}</span>}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/8 p-3">
          {caregiver ? <Avatar name={caregiver.displayName} size={44} />
            : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 text-[#b8c9ad]"><MessageCircle size={20} aria-hidden /></span>}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{caregiver?.displayName ?? (shift ? "La agencia está confirmando quién le atenderá" : "¿Tienes alguna pregunta?")}</p>
            {shift ? <p className="mt-0.5 text-xs text-white/70">{time(shift.scheduledStart)} – {time(shift.scheduledEnd)}</p>
              : <button type="button" onClick={() => navigate("/family/messages")} className="mt-0.5 text-left text-sm text-white/85 underline underline-offset-2">Escríbele a la agencia</button>}
          </div>
          {caregiver?.credentials?.length ? <ShieldCheck size={18} className="text-[#b8c9ad]" aria-label="Profesional verificada" /> : null}
        </div>
        {shift?.journey && <FamilyJourneyProgress journey={shift.journey} />}
      </section>

      {summary.length > 0 && (
        <section className="rounded-[22px] border border-[#102b57]/10 bg-white p-4 shadow-[0_8px_28px_rgba(16,43,87,.05)]">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#66845f]">Resumen de hoy</p>
          <dl className="mt-2 divide-y divide-[#102b57]/8">
            {summary.map((line) => (
              <div key={line.label} className="flex gap-3 py-2.5">
                <dt className="w-24 shrink-0 text-sm text-[#667085]">{line.label}</dt>
                <dd className="min-w-0 flex-1 text-sm font-medium text-[#173154]">{line.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

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
        </div> : <div className="rounded-2xl bg-[#f8f5ee] p-4 text-sm text-[#667085]">Todavía no hay actualizaciones hoy.</div>}
      </section>

      <button onClick={() => navigate("/family/history")} className="flex w-full items-center justify-between rounded-[20px] border border-[#102b57]/10 bg-[#f1eee6] px-4 py-3 text-left">
        <div><p className="font-medium text-[#173154]">Próximos turnos</p><p className="text-sm text-[#667085]">Consulta el calendario de cuidado.</p></div>
        <ChevronRight size={20} className="text-[#66845f]"/>
      </button>
    </div>
  );
}
