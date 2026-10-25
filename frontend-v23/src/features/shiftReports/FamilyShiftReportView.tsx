import type { FamilyReportItem, FamilyShiftReport } from "@/api/shiftReports";
import { Row, Section } from "./ShiftReportView";
import { otherDay, reportShortDate, reportTime } from "./reportFormat";

/**
 * Informe de Turno F3: what the family sees — the APPROVED version, only the sections the
 * agency shared. Same look as the agency and caregiver views (Section / Row). Free text is
 * shown exactly as written; nothing is translated or added.
 */
const join = (...parts: Array<unknown>) => parts.filter((p) => typeof p === "string" && p).join(" · ");
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const LISTS: Array<{ key: "meals" | "hydration" | "activities" | "mobility" | "hygiene" | "mood"; title: string; empty: string; line: (i: FamilyReportItem) => string }> = [
  { key: "meals", title: "Alimentación", empty: "Sin registros de comida.", line: (i) => join(i.mealType, i.amountConsumed) || "Comida registrada" },
  { key: "hydration", title: "Hidratación", empty: "Sin registros de hidratación.", line: (i) => str(i.amount) ?? "Registrada" },
  { key: "activities", title: "Actividades y acompañamiento", empty: "Sin actividades registradas.", line: (i) => join(i.label, typeof i.durationMinutes === "number" ? `${i.durationMinutes} min` : null) || "Actividad registrada" },
  { key: "mobility", title: "Movilidad", empty: "Sin registros de movilidad.", line: (i) => str(i.activity) ?? "Registrada" },
  { key: "hygiene", title: "Higiene", empty: "Sin registros de higiene.", line: (i) => str(i.result) ?? "Registrada" },
  { key: "mood", title: "Ánimo", empty: "Sin registros de ánimo.", line: (i) => str(i.mood) ?? "Registrado" },
];

export function FamilyShiftReportView({ report }: { report: FamilyShiftReport }) {
  const s = report.sections;
  const o = s.observations;
  const refDay = report.serviceDate; // PR calendar day of the shift: a time on another day shows its date
  const when = (at: string | null) => (at ? `${reportTime(at)}${otherDay(at, refDay) ? ` · ${otherDay(at, refDay)}` : ""}` : null);
  return (
    <div className="flex flex-col gap-3" data-testid="family-report-view">
      <div className="grid grid-cols-2 gap-3 text-[var(--text-small)]">
        <div><p className="text-[var(--color-text-muted)]">Agencia</p><p className="font-medium">{report.organization.name ?? "—"}</p></div>
        <div><p className="text-[var(--color-text-muted)]">Cuidadora</p><p className="font-medium">{report.caregiver.name ?? "—"}</p></div>
        <div><p className="text-[var(--color-text-muted)]">Fecha</p><p className="font-medium first-letter:uppercase">{reportShortDate(`${report.serviceDate}T16:00:00Z`)}</p></div>
        <div><p className="text-[var(--color-text-muted)]">Aprobado</p><p className="font-medium">{reportShortDate(report.approvedAt)}, {reportTime(report.approvedAt)}</p></div>
      </div>
      {s.schedule && (
        <dl className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] px-3 text-[var(--text-small)]" aria-label="Horarios">
          {([["Programado", `${reportTime(s.schedule.scheduledStart)} – ${when(s.schedule.scheduledEnd)}`], ["Llegada", when(s.schedule.arrivalAt) ?? "Sin registro"],
            ["Inicio del turno", when(s.schedule.startAt) ?? "—"], ["Final del turno", when(s.schedule.endAt) ?? "—"]] as const).map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-2"><dt className="text-[var(--color-text-secondary)]">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>
          ))}
        </dl>
      )}
      {LISTS.map(({ key, title, empty, line }) => {
        const items = s[key];
        if (!items) return null;
        return <Section key={key} title={title} empty={empty} count={items.length}>{items.map((i, n) => <Row key={n} refDay={refDay} at={i.at} note={str(i.note)}>{line(i)}</Row>)}</Section>;
      })}
      {o && (
        <Section title="Observaciones de la cuidadora" empty="Sin observaciones." count={o.notes.length + (o.caregiverNote ? 1 : 0)}>
          {o.notes.map((n, i) => <Row key={i} refDay={refDay} at={n.at}><span className="whitespace-pre-line">{n.text}</span></Row>)}
          {o.caregiverNote && <Row refDay={refDay} at={o.caregiverNote.at} note={o.caregiverNote.text}>Observación final</Row>}
        </Section>
      )}
      {s.incidents && (
        <Section title="Incidentes" empty="Ninguno registrado durante el turno." count={s.incidents.length}>
          {s.incidents.map((i, n) => <Row key={n} refDay={refDay} at={i.at} note={i.description}>{join("Incidente", i.severity)}</Row>)}
        </Section>
      )}
      {report.agencySummary && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-sage-300)] bg-[var(--color-sage-50)] p-3 text-[var(--text-small)]" data-testid="family-agency-summary">
          <p className="font-medium text-[var(--color-text-primary)]">Resumen de la agencia</p>
          <p className="mt-1 whitespace-pre-line text-[var(--color-text-secondary)]">{report.agencySummary}</p>
        </div>
      )}
      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Aprobado por la agencia a partir de los registros del turno. Solo ves las secciones que la agencia compartió contigo.</p>
    </div>
  );
}
