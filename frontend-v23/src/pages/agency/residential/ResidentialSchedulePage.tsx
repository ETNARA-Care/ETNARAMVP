import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { useOrgFeature } from "@/auth/orgFeatures";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import {
  scheduleApi, scheduleErrorMessage, type ScheduleEntry, type ScheduleEstablishment, type SchedulePublication, type ScheduleTemplate, type ScheduleWeek, type ScheduleIndividualShift } from "@/api/residentialSchedule";
import { csvLines } from "@/features/export/csv";
import { createLatestRequest, scopedTo, scopedValue, type OrganizationScoped, type ScreenScoped } from "@/features/residential/latestRequest";
import { isResidentialOrganization, RESIDENTIAL_PANEL_PATH } from "@/features/residential/modality";
import {
  addDays, entriesByDay, formatHours, mondayOf, puertoRicoDate, scheduleCsvRows, slotsFromWeek, staffNeedsReview, timeOf, warnedEntryIds, weekDays, individualByDay, warnedShiftIds } from "@/features/residential/schedule";

/**
 * 172 (hogares F2): calendario semanal del establecimiento. Solo hogares, solo con HOGAR_CALENDARIO y solo administración.
 * El borrador no es visible para el personal; publicar crea los turnos con las reglas de asignación de siempre
 * (elegibilidad, solapes). El portal no decide nada: muestra lo que devuelve el backend y vuelve a leer tras cada cambio.
 */
type Dialog =
  | { kind: "entry"; day: string; entry?: ScheduleEntry }
  | { kind: "remove"; entry: ScheduleEntry }
  | { kind: "copy" }
  | { kind: "template" }
  | { kind: "saveTemplate" }
  | { kind: "templates" }
  | { kind: "publish" }
  | { kind: "history" };

const formatDate = (date: string, language: string | undefined, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(language === "en" ? "en-US" : "es-PR", { timeZone: "UTC", ...opts });
const formatDateTime = (iso: string, language: string | undefined) =>
  new Date(iso).toLocaleString(language === "en" ? "en-US" : "es-PR", { timeZone: "America/Puerto_Rico" });

export function ResidentialSchedulePage() {
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const residential = isResidentialOrganization(activeOrganization);
  const enabled = useOrgFeature("HOGAR_CALENDARIO");
  const { t, i18n } = useTranslation("residential");
  const toast = useToast();
  const lang = i18n.resolvedLanguage;

  const [estState, setEstState] = useState<OrganizationScoped<ScheduleEstablishment[]> | null>(null);
  const [selected, setSelected] = useState<{ organizationId: string; locationId: string } | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(puertoRicoDate()));
  const [state, setState] = useState<OrganizationScoped<ScheduleWeek> | null>(null);
  // Auditoría 26-nov (como en la ficha de F1): el diálogo abierto pertenece a la organización, el establecimiento y la
  // semana en que se abrió; si cualquiera cambia (también si la lista de establecimientos se recarga y cambia la
  // selección), desaparece y no actúa sobre otro establecimiento ni otra semana.
  const [dialogState, setDialogState] = useState<ScreenScoped<Dialog> | null>(null);
  const [busy, setBusy] = useState(false);
  const latestList = useRef(createLatestRequest());
  const latest = useRef(createLatestRequest());

  const loadEstablishments = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !residential || !enabled) return;
    const request = latestList.current.begin();
    try {
      const { establishments } = await scheduleApi.establishments(organizationId, token);
      if (request.isCurrent()) setEstState({ organizationId, data: establishments, error: false });
    } catch {
      if (request.isCurrent()) setEstState({ organizationId, data: null, error: true });
    }
  }, [organizationId, residential, enabled]);
  useEffect(() => {
    const tracker = latestList.current;
    void loadEstablishments();
    return () => tracker.invalidate();
  }, [loadEstablishments]);
  const establishments = scopedTo(estState, organizationId)?.data ?? null;
  const listError = scopedTo(estState, organizationId)?.error === true;
  // El establecimiento elegido solo vale para la organización que lo eligió y si sigue en la lista.
  const chosen = selected && selected.organizationId === organizationId ? selected.locationId : null;
  const locationId = establishments?.some((e) => e.id === chosen) ? chosen : establishments?.[0]?.id ?? null;
  const key = locationId ? `${locationId}|${weekStart}` : undefined;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !locationId || !residential || !enabled) return;
    const request = latest.current.begin();
    const k = `${locationId}|${weekStart}`;
    try {
      const { schedule } = await scheduleApi.week(organizationId, locationId, weekStart, token);
      if (request.isCurrent()) setState({ organizationId, key: k, data: schedule, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, key: k, data: null, error: true });
    }
  }, [organizationId, locationId, weekStart, residential, enabled]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);
  const current = scopedTo(state, organizationId, key);
  const schedule = current?.data ?? null;
  const error = current?.error === true;
  const screenKey = `${organizationId ?? ""}|${key ?? ""}`;
  const [dialogScreen, setDialogScreen] = useState(screenKey);
  if (dialogScreen !== screenKey) { setDialogScreen(screenKey); setDialogState(null); }
  const dialog = current ? scopedValue(dialogState, organizationId, key) : null;
  const open = (d: Dialog) => organizationId && key && setDialogState({ organizationId, key, value: d });
  const close = () => setDialogState(null);

  /** Ejecuta un cambio, avisa y vuelve a leer la semana (el backend es la fuente de verdad). */
  const run = async (fn: (o: string, l: string, token: string) => Promise<unknown>, ok: string) => {
    const token = getToken();
    if (!organizationId || !locationId || !token) return false;
    setBusy(true);
    try {
      await fn(organizationId, locationId, token);
      toast.show(ok, "success"); close(); await load(); return true;
    } catch (e) {
      toast.show(scheduleErrorMessage(e), "danger"); await load(); return false;
    } finally { setBusy(false); }
  };

  if (!residential) return <Navigate to="/agency" replace />;
  if (!enabled) return <Navigate to={RESIDENTIAL_PANEL_PATH} replace />;

  const days = weekDays(weekStart);
  const byDay = schedule ? entriesByDay(weekStart, schedule.entries) : null;
  const individualDay = schedule ? individualByDay(weekStart, schedule.individualShifts ?? []) : null;
  const warned = schedule ? warnedEntryIds(schedule.warnings) : new Set<string>();
  const warnedShifts = schedule ? warnedShiftIds(schedule.warnings) : new Set<string>();
  const staffName = (membershipId: string) => schedule?.staff.find((s) => s.membershipId === membershipId)?.name ?? t("schedule.unnamed");
  const removedPublished = schedule?.entries.filter((e) => e.removed && e.published) ?? [];
  const exportCsv = () => {
    if (!schedule) return;
    const rows = scheduleCsvRows(
      [t("schedule.csv.date"), t("schedule.csv.start"), t("schedule.csv.end"), t("schedule.csv.hours"), t("schedule.csv.role"), t("schedule.csv.person"), t("schedule.csv.label"), t("schedule.csv.status")],
      schedule.entries, { unassigned: t("schedule.unassigned"), published: t("schedule.status.publishedShort"), draft: t("schedule.status.draft") });
    const blob = new Blob([csvLines(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `etnara-horario-${weekStart}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const weekLabel = `${formatDate(days[0], lang, { day: "numeric", month: "short" })} – ${formatDate(days[6], lang, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex flex-col gap-6" data-testid="residential-schedule">
      <div className="print:hidden"><PageHeader title={t("schedule.title")} description={t("schedule.description")} /></div>
      {listError ? <ErrorState kind="server" onRetry={() => { setEstState(null); void loadEstablishments(); }} /> : establishments === null ? <Skeleton className="h-32" /> : establishments.length === 0 ? (
        <EmptyState title={t("schedule.noEstablishmentsTitle")} description={t("schedule.noEstablishmentsDetail")} />
      ) : (
        <>
          <Card className="flex flex-col gap-3 print:hidden">
            <div className="flex flex-wrap items-end gap-3">
              {establishments.length > 1 && (
                <div className="min-w-56">
                  <Select label={t("schedule.establishment")} value={locationId ?? ""} onChange={(e) => organizationId && setSelected({ organizationId, locationId: e.target.value })}>
                    {establishments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>{t("schedule.prevWeek")}</Button>
                <span className="font-medium text-[var(--color-text-primary)]" data-testid="schedule-week-label">{weekLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>{t("schedule.nextWeek")}</Button>
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(puertoRicoDate()))}>{t("schedule.thisWeek")}</Button>
              </div>
            </div>
            {schedule && (
              <div className="flex flex-wrap items-center gap-2">
                <WeekStatus schedule={schedule} />
                <Button size="sm" disabled={busy || !schedule.week.hasUnpublishedChanges} onClick={() => open({ kind: "publish" })}>{schedule.week.status === "published" ? t("schedule.republish") : t("schedule.publish")}</Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => open({ kind: "copy" })}>{t("schedule.copyPrevious")}</Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => open({ kind: "template" })}>{t("schedule.applyTemplate")}</Button>
                <Button variant="ghost" size="sm" disabled={busy || schedule.entries.every((e) => e.removed)} onClick={() => open({ kind: "saveTemplate" })}>{t("schedule.saveTemplate")}</Button>
                <Button variant="ghost" size="sm" onClick={() => open({ kind: "templates" })}>{t("schedule.manageTemplates")}</Button>
                <Button variant="ghost" size="sm" disabled={schedule.week.version === 0} onClick={() => open({ kind: "history" })}>{t("schedule.history")}</Button>
                <Button variant="ghost" size="sm" onClick={() => window.print()}>{t("schedule.print")}</Button>
                <Button variant="ghost" size="sm" disabled={schedule.entries.length === 0} onClick={exportCsv}>{t("schedule.exportCsv")}</Button>
              </div>
            )}
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.draftExplain")}</p>
          </Card>

          {error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} /> : !schedule || !byDay ? <Skeleton className="h-64" /> : (
            <>
              <div className="hidden print:block">
                <h1 className="text-xl font-semibold">{t("schedule.printTitle", { name: schedule.establishment.name })}</h1>
                <p>{weekLabel} · <WeekStatusText schedule={schedule} /></p>
              </div>
              {schedule.warnings.length > 0 && (
                <Card className="border-[var(--color-warning-700)]/40 bg-[var(--color-warning-100)]" data-testid="schedule-warnings">
                  <p className="font-medium text-[var(--color-text-primary)]">{t("schedule.warnings.title", { count: schedule.warnings.length })}</p>
                  <ul className="mt-1 list-disc pl-5 text-[var(--text-small)]">
                    {schedule.warnings.map((w) => <li key={`${w.type}-${w.entryIds.join("-")}-${(w.shiftIds ?? []).join("-")}`}>{t(`schedule.warnings.${w.type}`, { name: staffName(w.membershipId) })}{(w.shiftIds ?? []).length > 0 ? ` ${t("schedule.warnings.withIndividual")}` : ""}</li>)}
                  </ul>
                  <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.warnings.publishBlocked")}</p>
                </Card>
              )}
              {/* Cada día con un ancho mínimo legible: en pantallas estrechas la semana se desplaza dentro de su caja. */}
              <div className="overflow-x-auto pb-1 print:overflow-visible">
              <div className="grid gap-3 md:grid-cols-[repeat(7,minmax(10.5rem,1fr))] print:grid-cols-7" data-testid="schedule-grid">
                {days.map((day) => (
                  <Card key={day} className="flex min-h-40 min-w-0 flex-col gap-2 p-3!">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium capitalize text-[var(--color-text-primary)]">{formatDate(day, lang, { weekday: "short", day: "numeric" })}</p>
                      <Button variant="ghost" size="sm" onClick={() => open({ kind: "entry", day })} aria-label={t("schedule.addEntryFor", { day: formatDate(day, lang, { weekday: "long", day: "numeric", month: "long" }) })}>
                        <span className="print:hidden">+</span>
                      </Button>
                    </div>
                    {(byDay.get(day) ?? []).length === 0 && (individualDay?.get(day) ?? []).length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.dayEmpty")}</p>
                      : (byDay.get(day) ?? []).map((e) => <EntryCard key={e.id} entry={e} warned={warned.has(e.id)} onEdit={() => open({ kind: "entry", day, entry: e })} onRemove={() => open({ kind: "remove", entry: e })} />)}
                    {(individualDay?.get(day) ?? []).map((x) => <IndividualCard key={x.shiftId} shift={x} warned={warnedShifts.has(x.shiftId)} />)}
                  </Card>
                ))}
              </div>
              </div>
              {removedPublished.length > 0 && (
                <Card className="print:hidden">
                  <p className="font-medium text-[var(--color-text-primary)]">{t("schedule.removedTitle")}</p>
                  <ul className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">
                    {removedPublished.map((e) => <li key={e.id}>{`${formatDate(e.startsAt.slice(0, 10), lang, { weekday: "short", day: "numeric" })} ${timeOf(e.startsAt)}–${timeOf(e.endsAt)} · ${e.workerName ?? t("schedule.unassigned")}`}</li>)}
                  </ul>
                  <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.removedExplain")}</p>
                </Card>
              )}
              <Summary schedule={schedule} staffName={staffName} language={lang} />
            </>
          )}
        </>
      )}

      {dialog?.kind === "entry" && schedule && locationId && (
        <EntryDialog day={dialog.day} entry={dialog.entry} days={days} schedule={schedule} busy={busy} onClose={close}
          onSave={(body) => run((o, l, token) => dialog.entry ? scheduleApi.updateEntry(o, dialog.entry.id, body, token) : scheduleApi.createEntry(o, l, weekStart, body, token), t("schedule.toasts.saved"))} />
      )}
      {dialog?.kind === "remove" && (
        <ConfirmDialog title={t("schedule.dialogs.removeTitle")} body={dialog.entry.published ? t("schedule.dialogs.removePublished") : t("schedule.dialogs.removeDraft")} confirm={t("schedule.dialogs.remove")} danger busy={busy} onClose={close}
          onConfirm={() => run((o, _l, token) => scheduleApi.removeEntry(o, dialog.entry.id, token), t("schedule.toasts.removed"))} />
      )}
      {dialog?.kind === "copy" && (
        <ConfirmDialog title={t("schedule.dialogs.copyTitle")} body={t("schedule.dialogs.copyBody", { from: formatDate(addDays(weekStart, -7), lang, { day: "numeric", month: "long" }) })} confirm={t("schedule.dialogs.copy")} busy={busy} onClose={close}
          onConfirm={() => run((o, l, token) => scheduleApi.copyWeek(o, l, weekStart, addDays(weekStart, -7), token), t("schedule.toasts.copied"))} />
      )}
      {dialog?.kind === "template" && organizationId && locationId && (
        <ApplyTemplateDialog organizationId={organizationId} locationId={locationId} busy={busy} onClose={close}
          onApply={(templateId) => run((o, l, token) => scheduleApi.applyTemplate(o, l, weekStart, templateId, token), t("schedule.toasts.applied"))} />
      )}
      {dialog?.kind === "saveTemplate" && schedule && (
        <SaveTemplateDialog busy={busy} onClose={close}
          onSave={(name) => run((o, l, token) => scheduleApi.createTemplate(o, l, { name, slots: slotsFromWeek(schedule.entries) }, token), t("schedule.toasts.templateSaved"))} />
      )}
      {dialog?.kind === "templates" && organizationId && locationId && (
        <TemplatesDialog organizationId={organizationId} locationId={locationId} onClose={close} />
      )}
      {dialog?.kind === "publish" && schedule && (
        <ConfirmDialog title={t("schedule.dialogs.publishTitle")} confirm={t("schedule.dialogs.publishConfirm")} busy={busy || schedule.warnings.length > 0} onClose={close}
          body={schedule.warnings.length > 0 ? t("schedule.warnings.publishBlocked") : t("schedule.dialogs.publishBody")}
          onConfirm={() => run((o, l, token) => scheduleApi.publish(o, l, weekStart, token), t("schedule.toasts.published"))} />
      )}
      {dialog?.kind === "history" && organizationId && locationId && (
        <HistoryDialog organizationId={organizationId} locationId={locationId} weekStart={weekStart} onClose={close} />
      )}
    </div>
  );
}

function WeekStatusText({ schedule }: { schedule: ScheduleWeek }) {
  const { t } = useTranslation("residential");
  const w = schedule.week;
  if (w.status === "published") return <>{w.hasUnpublishedChanges ? t("schedule.status.publishedWithChanges", { version: w.version }) : t("schedule.status.published", { version: w.version })}</>;
  return <>{w.status === "draft" ? t("schedule.status.draft") : t("schedule.status.empty")}</>;
}
function WeekStatus({ schedule }: { schedule: ScheduleWeek }) {
  const w = schedule.week;
  const tone = w.status === "published" ? (w.hasUnpublishedChanges ? "warning" : "success") : "neutral";
  return <span data-testid="schedule-status"><Badge tone={tone}><WeekStatusText schedule={schedule} /></Badge></span>;
}

function EntryCard({ entry, warned, onEdit, onRemove }: { entry: ScheduleEntry; warned: boolean; onEdit: () => void; onRemove: () => void }) {
  const { t } = useTranslation("residential");
  return (
    <div data-testid="schedule-entry" className={`flex flex-col gap-1 rounded-[var(--radius-sm)] border p-2 text-[var(--text-small)] ${warned ? "border-[var(--color-warning-700)]" : "border-[var(--color-border)]"}`}>
      <p className="font-medium text-[var(--color-text-primary)]">{`${timeOf(entry.startsAt)}–${timeOf(entry.endsAt)}`}{entry.endsAt.slice(0, 10) !== entry.startsAt.slice(0, 10) && <span className="text-[var(--color-text-secondary)]">{` (${t("schedule.nextDay")})`}</span>}</p>
      <p className="text-[var(--color-text-primary)]">{entry.workerName ?? t("schedule.unassigned")}</p>
      <p className="text-[var(--color-text-secondary)]">{entry.requiredRole}{entry.label ? ` · ${entry.label}` : ""}</p>
      <div className="flex flex-wrap gap-1">
        <Badge tone={entry.published ? "success" : "neutral"}>{entry.published ? t("schedule.status.publishedShort") : t("schedule.status.draft")}</Badge>
        {entry.assignmentStatus && <Badge tone={entry.assignmentStatus === "accepted" ? "success" : "accent"}>{t(`schedule.assignment.${entry.assignmentStatus}`)}</Badge>}
        {entry.substitution && <Badge tone="warning">{t("assignments.scheduleSubstitution", { name: entry.substitution.substituteName ?? t("assignments.unnamed"), time: timeOf(entry.substitution.effectiveAt) })}</Badge>}
        {warned && <Badge tone="warning">{t("schedule.warnings.badge")}</Badge>}
      </div>
      <div className="flex flex-wrap gap-1 print:hidden">
        <Button variant="ghost" size="sm" onClick={onEdit}>{t("schedule.edit")}</Button>
        <Button variant="ghost" size="sm" onClick={onRemove}>{t("schedule.remove")}</Button>
      </div>
    </div>
  );
}

/** 27-nov: turno individual del establecimiento (de «Turnos»): solo lectura aquí, se gestiona en «Turnos». */
function IndividualCard({ shift, warned }: { shift: ScheduleIndividualShift; warned: boolean }) {
  const { t } = useTranslation("residential");
  const place = shift.target === "room" ? t("schedule.individual.room", { name: shift.roomName ?? "" })
    : shift.target === "resident" ? t("schedule.individual.resident", { name: shift.residentName ?? "" }) : t("schedule.individual.establishment");
  return (
    <div data-testid="schedule-individual" className={`flex flex-col gap-1 rounded-[var(--radius-sm)] border border-dashed p-2 text-[var(--text-small)] ${warned ? "border-[var(--color-warning-700)]" : "border-[var(--color-border)]"}`}>
      <p className="font-medium text-[var(--color-text-primary)]">{`${timeOf(shift.startsAt)}–${timeOf(shift.endsAt)}`}{shift.endsAt.slice(0, 10) !== shift.startsAt.slice(0, 10) && <span className="text-[var(--color-text-secondary)]"> {t("schedule.nextDay")}</span>}</p>
      <p className="text-[var(--color-text-primary)]">{shift.workerName ?? t("schedule.unassigned")}</p>
      <p className="text-[var(--color-text-secondary)]">{shift.requiredRole} · {place}</p>
      <div className="flex flex-wrap gap-1">
        <Badge tone="neutral">{t("schedule.individual.badge")}</Badge>
        {shift.assignmentStatus && <Badge tone={shift.assignmentStatus === "accepted" ? "success" : "accent"}>{t(`schedule.assignment.${shift.assignmentStatus}`)}</Badge>}
        {warned && <Badge tone="warning">{t("schedule.warnings.badge")}</Badge>}
      </div>
      <Link to={`/agency/shifts/${shift.shiftId}`} className="text-[var(--color-accent-700)] underline print:hidden">{t("schedule.individual.open")}</Link>
    </div>
  );
}

function Summary({ schedule, staffName, language }: { schedule: ScheduleWeek; staffName: (id: string) => string; language: string | undefined }) {
  const { t } = useTranslation("residential");
  const s = schedule.summary;
  return (
    <Card className="flex flex-col gap-3" data-testid="schedule-summary">
      <p className="font-medium text-[var(--color-text-primary)]">{t("schedule.summary.title")}</p>
      <p className="text-[var(--text-small)]">{t("schedule.summary.total", { hours: formatHours(s.totalMinutes, language) })} · {t("schedule.summary.unassigned", { count: s.unassignedEntries })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">{t("schedule.summary.byPerson")}</p>
          {s.byWorker.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.summary.none")}</p> : (
            <ul className="text-[var(--text-small)]">{s.byWorker.map((w) => <li key={w.membershipId} className="flex justify-between gap-2"><span>{staffName(w.membershipId)}</span><span>{formatHours(w.minutes, language)}</span></li>)}</ul>
          )}
        </div>
        <div>
          <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">{t("schedule.summary.byDay")}</p>
          {s.byDay.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.summary.none")}</p> : (
            <ul className="text-[var(--text-small)]">{s.byDay.map((d) => <li key={d.date} className="flex justify-between gap-2"><span className="capitalize">{formatDate(d.date, language, { weekday: "long", day: "numeric" })}</span><span>{formatHours(d.minutes, language)}</span></li>)}</ul>
          )}
        </div>
      </div>
      <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.summary.note")}</p>
    </Card>
  );
}

function Footer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation("residential");
  return <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("schedule.dialogs.cancel")}</Button>{children}</div>;
}
function ConfirmDialog({ title, body, confirm, danger, busy, onClose, onConfirm }: { title: string; body: string; confirm: string; danger?: boolean; busy: boolean; onClose: () => void; onConfirm: () => Promise<boolean> }) {
  return (
    <Modal open onClose={onClose} title={title} sheetOnMobile
      footer={<Footer onClose={onClose}><Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={() => void onConfirm()}>{confirm}</Button></Footer>}>
      <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">{body}</p>
    </Modal>
  );
}

function EntryDialog({ day, entry, days, schedule, busy, onClose, onSave }: {
  day: string; entry?: ScheduleEntry; days: string[]; schedule: ScheduleWeek; busy: boolean; onClose: () => void;
  onSave: (body: { startsAt: string; durationMinutes: number; requiredRole?: string; membershipId: string | null; label: string | null }) => Promise<boolean>;
}) {
  const { t, i18n } = useTranslation("residential");
  const [date, setDate] = useState(entry ? entry.startsAt.slice(0, 10) : day);
  const [time, setTime] = useState(entry ? timeOf(entry.startsAt) : "07:00");
  const [hours, setHours] = useState(entry ? String(entry.durationMinutes / 60) : "8");
  const [role, setRole] = useState(entry?.requiredRole ?? "");
  const [membershipId, setMembershipId] = useState(entry?.membershipId ?? "");
  const [label, setLabel] = useState(entry?.label ?? "");
  const minutes = Math.round(Number(hours.replace(",", ".")) * 60);
  const durationValid = Number.isFinite(minutes) && minutes >= 15 && minutes <= 1440;
  const timeValid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  return (
    <Modal open onClose={onClose} title={entry ? t("schedule.dialogs.editTitle") : t("schedule.dialogs.addTitle")} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || !durationValid || !timeValid} onClick={() => void onSave({
        startsAt: `${date}T${time}`, durationMinutes: minutes, ...(role.trim() ? { requiredRole: role.trim() } : {}), membershipId: membershipId || null, label: label.trim() || null,
      })}>{t("schedule.dialogs.save")}</Button></Footer>}>
      <div className="flex flex-col gap-3">
        {entry?.published && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.dialogs.editPublished")}</p>}
        <Select label={t("schedule.dialogs.day")} value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((d) => <option key={d} value={d}>{formatDate(d, i18n.resolvedLanguage, { weekday: "long", day: "numeric", month: "long" })}</option>)}
        </Select>
        <Input label={t("schedule.dialogs.start")} type="time" value={time} onChange={(e) => setTime(e.target.value)} error={timeValid ? undefined : t("schedule.dialogs.startError")} />
        <Input label={t("schedule.dialogs.hours")} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} error={durationValid ? undefined : t("schedule.dialogs.hoursError")} hint={t("schedule.dialogs.hoursHint")} />
        <Input label={t("schedule.dialogs.role")} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} hint={t("schedule.dialogs.roleHint")} />
        <Select label={t("schedule.dialogs.person")} value={membershipId} onChange={(e) => setMembershipId(e.target.value)} hint={t("schedule.dialogs.personHint")}>
          <option value="">{t("schedule.unassigned")}</option>
          {schedule.staff.map((s) => <option key={s.membershipId} value={s.membershipId}>{`${s.name ?? t("schedule.unnamed")}${staffNeedsReview(s) ? ` (${t("schedule.dialogs.reviewCompliance")})` : ""}`}</option>)}
        </Select>
        <Input label={t("schedule.dialogs.label")} value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} hint={t("schedule.dialogs.labelHint")} />
      </div>
    </Modal>
  );
}

function useTemplates(organizationId: string, locationId: string) {
  const [state, setState] = useState<OrganizationScoped<ScheduleTemplate[]> | null>(null);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) return;
    scheduleApi.templates(organizationId, locationId, token)
      .then(({ templates }) => { if (active) setState({ organizationId, key: locationId, data: templates, error: false }); })
      .catch(() => { if (active) setState({ organizationId, key: locationId, data: null, error: true }); });
    return () => { active = false; };
  }, [organizationId, locationId, turn]);
  return { state: scopedTo(state, organizationId, locationId), reload: () => setTurn((n) => n + 1) };
}

function ApplyTemplateDialog({ organizationId, locationId, busy, onClose, onApply }: { organizationId: string; locationId: string; busy: boolean; onClose: () => void; onApply: (id: string) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const { state } = useTemplates(organizationId, locationId);
  const active = state?.data?.filter((x) => !x.archived) ?? null;
  const [templateId, setTemplateId] = useState("");
  const chosen = active?.some((x) => x.id === templateId) ? templateId : active?.[0]?.id ?? "";
  return (
    <Modal open onClose={onClose} title={t("schedule.dialogs.applyTitle")} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || !chosen} onClick={() => void onApply(chosen)}>{t("schedule.dialogs.apply")}</Button></Footer>}>
      {state?.error ? <ErrorState kind="server" /> : active === null ? <Skeleton className="h-16" /> : active.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("schedule.dialogs.noTemplates")}</p> : (
        <div className="flex flex-col gap-3">
          <Select label={t("schedule.dialogs.template")} value={chosen} onChange={(e) => setTemplateId(e.target.value)}>
            {active.map((x) => <option key={x.id} value={x.id}>{t("schedule.dialogs.templateOption", { name: x.name, count: x.slots.reduce((n, s) => n + s.headcount, 0) })}</option>)}
          </Select>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.dialogs.applyExplain")}</p>
        </div>
      )}
    </Modal>
  );
}

function SaveTemplateDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (name: string) => Promise<boolean> }) {
  const { t } = useTranslation("residential");
  const [name, setName] = useState("");
  return (
    <Modal open onClose={onClose} title={t("schedule.dialogs.saveTemplateTitle")} sheetOnMobile
      footer={<Footer onClose={onClose}><Button disabled={busy || name.trim().length === 0} onClick={() => void onSave(name.trim())}>{t("schedule.dialogs.save")}</Button></Footer>}>
      <div className="flex flex-col gap-3">
        <Input label={t("schedule.dialogs.templateName")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("schedule.dialogs.saveTemplateExplain")}</p>
      </div>
    </Modal>
  );
}

function TemplatesDialog({ organizationId, locationId, onClose }: { organizationId: string; locationId: string; onClose: () => void }) {
  const { t } = useTranslation("residential");
  const toast = useToast();
  const { state, reload } = useTemplates(organizationId, locationId);
  const [busy, setBusy] = useState(false);
  const toggle = async (x: ScheduleTemplate) => {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try { await scheduleApi.updateTemplate(organizationId, x.id, { archived: !x.archived }, token); toast.show(x.archived ? t("schedule.toasts.templateRestored") : t("schedule.toasts.templateArchived"), "success"); }
    catch (e) { toast.show(scheduleErrorMessage(e), "danger"); }
    finally { setBusy(false); reload(); }
  };
  return (
    <Modal open onClose={onClose} title={t("schedule.dialogs.templatesTitle")} sheetOnMobile footer={<Footer onClose={onClose}>{null}</Footer>}>
      {state?.error ? <ErrorState kind="server" onRetry={reload} /> : !state?.data ? <Skeleton className="h-16" /> : state.data.length === 0 ? <p className="text-[var(--color-text-secondary)]">{t("schedule.dialogs.noTemplates")}</p> : (
        <ul className="flex flex-col gap-2">
          {state.data.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-primary)]">{t("schedule.dialogs.templateOption", { name: x.name, count: x.slots.reduce((n, s) => n + s.headcount, 0) })}{x.archived ? ` · ${t("schedule.dialogs.archived")}` : ""}</span>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggle(x)}>{x.archived ? t("schedule.dialogs.restore") : t("schedule.dialogs.archive")}</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function HistoryDialog({ organizationId, locationId, weekStart, onClose }: { organizationId: string; locationId: string; weekStart: string; onClose: () => void }) {
  const { t, i18n } = useTranslation("residential");
  const [state, setState] = useState<OrganizationScoped<SchedulePublication[]> | null>(null);
  const key = `${locationId}|${weekStart}`;
  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) return;
    scheduleApi.publications(organizationId, locationId, weekStart, token)
      .then(({ publications }) => { if (active) setState({ organizationId, key, data: publications, error: false }); })
      .catch(() => { if (active) setState({ organizationId, key, data: null, error: true }); });
    return () => { active = false; };
  }, [organizationId, locationId, weekStart, key]);
  const current = scopedTo(state, organizationId, key);
  return (
    <Modal open onClose={onClose} title={t("schedule.dialogs.historyTitle")} sheetOnMobile footer={<Footer onClose={onClose}>{null}</Footer>}>
      {current?.error ? <ErrorState kind="server" /> : !current?.data ? <Skeleton className="h-16" /> : (
        <ul className="flex flex-col gap-2" data-testid="schedule-history">
          {current.data.map((p) => (
            <li key={p.version} className="text-[var(--text-small)]">
              <span className="font-medium text-[var(--color-text-primary)]">{t("schedule.dialogs.historyVersion", { version: p.version })}</span>
              {` · ${formatDateTime(p.publishedAt, i18n.resolvedLanguage)} · ${p.actorEmail ?? t("schedule.unnamed")}`}
              <br />{t("schedule.dialogs.historyCounts", { count: p.shiftCount, created: p.shiftsCreated, cancelled: p.shiftsCancelled })}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
