import type { ReactNode } from "react";
import type { ShiftReportContent } from "@/api/shiftReports";
import { PROXIMITY_TEXT } from "@/features/serviceLocation/arrivalText";
import { otherDay, reportDayKey, reportShortDate, reportTime } from "./reportFormat";

/**
 * Read-only body of a shift report (Informe de Turno). Every line comes from a
 * real record; an empty section says so. Free text is shown exactly as written.
 * Shared by the agency view (F1) and the caregiver (F2); the family view (F3) reuses Section and Row.
 */

export function Section({ title, empty, children, count }: { title: string; empty: string; count: number; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--color-border)] pt-3" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[var(--text-small)] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{title}</h3>
        <span className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{count}</span>
      </div>
      {count === 0 ? <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-muted)]">{empty}</p> : <ul className="mt-2 flex flex-col gap-2">{children}</ul>}
    </section>
  );
}
/** One record. `refDay` (the shift's scheduled day): a time on another day also shows its date. */
export function Row({ at, children, note, refDay }: { at: string; children: ReactNode; note?: string | null; refDay?: string | null }) {
  const day = otherDay(at, refDay);
  return (
    <li className="flex gap-3 text-[var(--text-small)]">
      <span className="w-[5.5rem] shrink-0 whitespace-nowrap tabular-nums text-[var(--color-text-muted)]">{reportTime(at)}{day && <span className="block text-[var(--text-caption)]" data-testid="other-day">{day}</span>}</span>
      <span className="min-w-0 text-[var(--color-text-primary)]">{children}{note && <span className="mt-0.5 block whitespace-pre-line text-[var(--color-text-secondary)]">{note}</span>}</span>
    </li>
  );
}
const join = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" · ");

/** A time, plus its date when it is not the shift's scheduled day (a visit can cross midnight). */
function Moment({ at, refDay }: { at: string; refDay: string }) {
  const day = otherDay(at, refDay);
  return <>{reportTime(at)}{day && <span className="font-normal text-[var(--color-text-secondary)]" data-testid="other-day"> · {day}</span>}</>;
}

export function ShiftReportView({ content }: { content: ShiftReportContent }) {
  const s = content.sections;
  const t = content.times;
  const refDay = reportDayKey(content.shift.scheduledStart);
  return (
    <div className="flex flex-col gap-3" data-testid="shift-report-view">
      <div className="grid grid-cols-2 gap-3 text-[var(--text-small)] sm:grid-cols-4">
        <div><p className="text-[var(--color-text-muted)]">Residente</p><p className="font-medium">{content.recipient.name}</p></div>
        <div><p className="text-[var(--color-text-muted)]">Cuidadora</p><p className="font-medium">{content.caregiver.name ?? "—"}</p></div>
        <div><p className="text-[var(--color-text-muted)]">Fecha</p><p className="font-medium first-letter:uppercase">{reportShortDate(content.shift.scheduledStart)}</p></div>
        <div><p className="text-[var(--color-text-muted)]">Programado</p><p className="font-medium"><span className="whitespace-nowrap">{reportTime(content.shift.scheduledStart)} –</span> <span className="whitespace-nowrap"><Moment at={content.shift.scheduledEnd} refDay={refDay} /></span></p></div>
      </div>
      <dl className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] px-3 text-[var(--text-small)]" aria-label="Horas reales">
        <div className="py-2">
          <div className="flex items-baseline justify-between gap-3"><dt className="text-[var(--color-text-secondary)]">Llegada («Llegué»)</dt><dd className="text-right font-semibold tabular-nums">{t.arrival ? <Moment at={t.arrival.at} refDay={refDay} /> : "Sin registro"}</dd></div>
          {t.arrival && <p className="mt-0.5 text-[var(--text-caption)] text-[var(--color-text-muted)]">{PROXIMITY_TEXT[t.arrival.proximity as keyof typeof PROXIMITY_TEXT] ?? t.arrival.proximity}</p>}
        </div>
        <div className="flex items-baseline justify-between gap-3 py-2"><dt className="text-[var(--color-text-secondary)]">Inicio del turno</dt><dd className="text-right font-semibold tabular-nums"><Moment at={t.start.at} refDay={refDay} />{t.start.recordedOffline ? " · sin señal" : ""}</dd></div>
        <div className="flex items-baseline justify-between gap-3 py-2"><dt className="text-[var(--color-text-secondary)]">Final del turno</dt><dd className="text-right font-semibold tabular-nums"><Moment at={t.end.at} refDay={refDay} />{t.end.recordedOffline ? " · sin señal" : ""}</dd></div>
      </dl>
      <Section title="Alimentación" empty="Sin registros de comida." count={s.meals.length}>
        {s.meals.map((m) => <Row key={m.careEventId} refDay={refDay} at={m.at} note={m.note}>{join(m.mealType, m.amountConsumed)}</Row>)}
      </Section>
      <Section title="Hidratación" empty="Sin registros de hidratación." count={s.hydration.length}>
        {s.hydration.map((m) => <Row key={m.careEventId} refDay={refDay} at={m.at} note={m.note}>{m.amount ?? "Registrada"}</Row>)}
      </Section>
      <Section title="Higiene" empty="Sin registros de higiene." count={s.hygiene.length}>
        {s.hygiene.map((m) => <Row key={m.careEventId} refDay={refDay} at={m.at} note={m.note}>{m.result ?? "Registrada"}</Row>)}
      </Section>
      <Section title="Movilidad" empty="Sin registros de movilidad." count={s.mobility.length}>
        {s.mobility.map((m) => <Row key={m.careEventId} refDay={refDay} at={m.at} note={m.note}>{m.activity ?? "Registrada"}</Row>)}
      </Section>
      <Section title="Actividades y acompañamiento" empty="Sin actividades registradas." count={s.activities.length}>
        {s.activities.map((m) => <Row key={m.careEventId} refDay={refDay} at={m.at} note={m.note}>{join(m.label, m.durationMinutes ? `${m.durationMinutes} min` : null)}</Row>)}
      </Section>
      <Section title="Ánimo" empty="Sin registros de ánimo." count={s.mood.length}>
        {s.mood.map((m) => <Row key={m.careEventId} refDay={refDay} at={m.at} note={m.note}>{m.mood ?? "Registrado"}</Row>)}
      </Section>
      <Section title="Observaciones de la cuidadora" empty="Sin observaciones." count={s.notes.length + content.observations.length}>
        {s.notes.map((n) => <Row key={n.careEventId} refDay={refDay} at={n.at}><span className="whitespace-pre-line">{n.text}</span></Row>)}
        {content.observations.map((o) => <Row key={o.observationId} refDay={refDay} at={o.at} note={o.description}>Observación · {o.category}{o.status === "reviewed" ? " · revisada" : ""}</Row>)}
      </Section>
      <Section title="Incidentes" empty="Ninguno registrado durante el turno." count={content.incidents.length}>
        {content.incidents.map((i) => <Row key={i.incidentId} refDay={refDay} at={i.at} note={i.description}>Incidente · {i.severity}</Row>)}
      </Section>
      {content.photos.count > 0 && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{content.photos.count} foto{content.photos.count === 1 ? "" : "s"} del turno (se comparten con su propia aprobación).</p>}
      <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Generado a partir de los registros del turno. ETNARA no añade actividades ni marca tareas como hechas.</p>
    </div>
  );
}
