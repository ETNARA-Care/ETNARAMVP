import { Card, Badge, Avatar, Timeline } from "@/components/ui";
import { useResident, useShiftsForResident, useCareEventsForShift, useWorkers } from "@/mocks/DemoStoreContext";
import { humanizeForFamily } from "@/mocks/humanize";

const RESIDENT_ID = "res-carmen"; // Ana Rivera -- identidad demo fija, sin auth todavía

export function FamilyTodayPage() {
  const resident = useResident(RESIDENT_ID)!;
  const shifts = useShiftsForResident(RESIDENT_ID);
  const shift = shifts.find((s) => s.status !== "completed") ?? shifts[0];
  const worker = useWorkers().find((w) => w.id === shift?.workerId);
  const events = useCareEventsForShift(shift?.id ?? "");
  const entries = events.map((e) => ({
    id: e.id,
    time: new Date(e.createdAt).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" }),
    title: humanizeForFamily(e, resident),
    tone: e.type === "incident" ? ("danger" as const) : undefined,
  }));
  const lastEntry = entries[entries.length - 1];

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <div>
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">Buenos días, Ana</p>
        <h1 className="font-display text-[var(--text-h1)] text-[var(--color-text-primary)]">
          {resident.name.split(" ")[0]} está bien hoy
        </h1>
      </div>

      <Card className="flex items-center gap-3">
        <Avatar name={worker?.name ?? "Sin asignar"} size={48} />
        <div className="flex-1">
          <p className="font-medium text-[var(--color-text-primary)]">{worker?.name ?? "Aún sin cuidador asignado"}</p>
          {shift && (
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
              {worker ? "Cuidadora de hoy" : "Turno"} · {shift.start} – {shift.end}
            </p>
          )}
        </div>
        {shift && (
          <Badge tone={shift.status === "in_progress" ? "success" : shift.status === "completed" ? "neutral" : "warning"}>
            {shift.status === "in_progress" ? "En turno" : shift.status === "completed" ? "Finalizado" : shift.status === "assigned" ? "Asignado" : "Por confirmar"}
          </Badge>
        )}
      </Card>

      <Card>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-1">Última actualización</p>
        {lastEntry ? (
          <>
            <p className="text-[var(--text-body-lg)] text-[var(--color-text-primary)] font-display">"{lastEntry.title}"</p>
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">{lastEntry.time}</p>
          </>
        ) : (
          <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">Todavía no hay actualizaciones hoy.</p>
        )}
      </Card>

      <div>
        <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)] mb-3">Resumen del día</p>
        {entries.length > 0 ? (
          <Timeline entries={entries} />
        ) : (
          <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay preocupaciones reportadas.</p>
        )}
      </div>
    </div>
  );
}
