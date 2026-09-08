import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card, EmptyState, Timeline, IconButton } from "@/components/ui";
import { Clock3 } from "lucide-react";
import {
  useResident, useCompletedShiftsForResident, useCareEventsForShift, useWorkers,
} from "@/mocks/DemoStoreContext";
import { humanizeForFamily } from "@/mocks/humanize";
import type { DemoShift } from "@/mocks/types";

const RESIDENT_ID = "res-carmen"; // Ana Rivera -- identidad demo fija, sin auth todavía

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-PR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

/** Resumen humano de un día: la primera frase generada por humanize.ts, o un texto neutro si no hubo eventos. */
function useDaySummary(shift: DemoShift, residentName: string) {
  const resident = useResident(RESIDENT_ID)!;
  const events = useCareEventsForShift(shift.id);
  const meaningful = events.find((e) => e.type !== "check_in" && e.type !== "check_out");
  if (!meaningful) return `Turno de ${residentName.split(" ")[0]} sin novedades.`;
  return humanizeForFamily(meaningful, resident);
}

function HistoryDayRow({ shift, onOpen }: { shift: DemoShift; onOpen: (id: string) => void }) {
  const resident = useResident(shift.residentId)!;
  const worker = useWorkers().find((w) => w.id === shift.workerId);
  const summary = useDaySummary(shift, resident.name);
  return (
    <button onClick={() => onOpen(shift.id)} className="text-left w-full">
      <Card className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="font-medium text-[var(--color-text-primary)] capitalize">{formatDate(shift.date)}</p>
          <span className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{shift.start} – {shift.end}</span>
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
          {worker ? `Cuidador: ${worker.name}` : "Sin cuidador registrado"}
        </p>
        <p className="text-[var(--text-body)] text-[var(--color-text-primary)] mt-1">"{summary}"</p>
      </Card>
    </button>
  );
}

function HistoryDayDetail({ shift, onBack }: { shift: DemoShift; onBack: () => void }) {
  const resident = useResident(shift.residentId)!;
  const worker = useWorkers().find((w) => w.id === shift.workerId);
  const events = useCareEventsForShift(shift.id);
  const entries = events.map((e) => ({
    id: e.id,
    time: new Date(e.createdAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: humanizeForFamily(e, resident),
    tone: e.type === "incident" ? ("danger" as const) : undefined,
  }));

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <div className="flex items-center gap-2">
        <IconButton icon={<ArrowLeft size={18} />} label="Volver al historial" onClick={onBack} />
        <div>
          <p className="font-display text-[var(--text-h3)] capitalize">{formatDate(shift.date)}</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {shift.start} – {shift.end} {worker ? `· ${worker.name}` : ""}
          </p>
        </div>
      </div>
      {entries.length > 0 ? (
        <Timeline entries={entries} />
      ) : (
        <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay eventos registrados ese día.</p>
      )}
    </div>
  );
}

export function FamilyHistoryPage() {
  const shifts = useCompletedShiftsForResident(RESIDENT_ID);
  const [openShiftId, setOpenShiftId] = useState<string | null>(null);
  const openShift = shifts.find((s) => s.id === openShiftId);

  if (openShift) {
    return <HistoryDayDetail shift={openShift} onBack={() => setOpenShiftId(null)} />;
  }

  return (
    <div>
      <PageHeader title="Historial" description="Días anteriores del cuidado de Carmen." />
      {shifts.length === 0 ? (
        <EmptyState
          icon={<Clock3 size={28} />}
          title="No hay actividad registrada todavía."
          description="Cuando haya más días con registros, aparecerán aquí ordenados por fecha."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {shifts.map((s) => <HistoryDayRow key={s.id} shift={s} onOpen={setOpenShiftId} />)}
        </div>
      )}
    </div>
  );
}
