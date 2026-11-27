import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Badge, Button, Card, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { scheduleApi, type MyScheduleWeek } from "@/api/residentialSchedule";
import { createLatestRequest, scopedTo, type OrganizationScoped } from "@/features/residential/latestRequest";
import { addDays, formatHours, mondayOf, puertoRicoDate, timeOf } from "@/features/residential/schedule";

/**
 * 27-nov (decisión de Rafa): «Mi horario» del cuidador en un hogar. Su semana publicada: sus turnos (del calendario o
 * de «Turnos»), horas por día y días sin turnos; semanas anteriores y siguientes. Nunca borradores ni compañeros: el
 * backend solo devuelve sus propios turnos. La misma cuenta y la misma aplicación.
 */
const formatDay = (date: string, language: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(language === "en" ? "en-US" : "es-PR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function CaregiverSchedulePage() {
  const { t, i18n } = useTranslation("residential");
  const lang = i18n.language;
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [weekStart, setWeekStart] = useState(() => mondayOf(puertoRicoDate()));
  const [state, setState] = useState<OrganizationScoped<MyScheduleWeek> | null>(null);
  const latest = useRef(createLatestRequest());
  const key = weekStart;

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    const request = latest.current.begin();
    try {
      const r = await scheduleApi.mine(organizationId, weekStart, token);
      if (request.isCurrent()) setState({ organizationId, key, data: r.schedule, error: false });
    } catch {
      if (request.isCurrent()) setState({ organizationId, key, data: null, error: true });
    }
  }, [organizationId, weekStart, key]);
  useEffect(() => {
    const tracker = latest.current;
    void load();
    return () => tracker.invalidate();
  }, [load]);

  const current = scopedTo(state, organizationId, key);
  const week = current?.data ?? null;
  const thisWeek = mondayOf(puertoRicoDate());
  const shiftsById = new Map((week?.shifts ?? []).map((s) => [s.shiftId, s]));
  const range = `${formatDay(weekStart, lang)} – ${formatDay(addDays(weekStart, 6), lang)}`;

  return (
    <div className="flex flex-col gap-4" data-testid="my-schedule">
      <PageHeader title={t("mySchedule.title")} description={t("mySchedule.description")} />
      <div className="flex items-center justify-between gap-2" role="group" aria-label={t("mySchedule.weekNav")}>
        <Button variant="secondary" size="sm" icon={<ChevronLeft size={18} />} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("mySchedule.prev")}>
          <span className="sr-only sm:not-sr-only">{t("mySchedule.prev")}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeek)} disabled={weekStart === thisWeek}>{t("mySchedule.thisWeek")}</Button>
        <Button variant="secondary" size="sm" icon={<ChevronRight size={18} />} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("mySchedule.next")}>
          <span className="sr-only sm:not-sr-only">{t("mySchedule.next")}</span>
        </Button>
      </div>
      <p className="text-center text-[var(--text-small)] capitalize text-[var(--color-text-secondary)]" data-testid="my-schedule-range">{range}</p>

      {current?.error ? <ErrorState kind="server" onRetry={() => { setState(null); void load(); }} />
        : !week ? <Skeleton className="h-64" /> : (
          <>
            <Card className="flex items-center gap-3" data-testid="my-schedule-total">
              <CalendarDays size={22} aria-hidden />
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{t("mySchedule.total", { hours: formatHours(week.totalMinutes, lang) })}</p>
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">
                  {t("mySchedule.daysWithShifts", { count: week.days.filter((d) => d.shiftIds.length > 0).length })}
                </p>
              </div>
            </Card>
            <ul className="flex flex-col gap-3">
              {week.days.map((day) => (
                <li key={day.date}>
                  <Card className="flex flex-col gap-2" data-testid="my-schedule-day">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium capitalize text-[var(--color-text-primary)]">{formatDay(day.date, lang)}{day.date === puertoRicoDate() && <span className="ml-2 align-middle"><Badge tone="accent">{t("mySchedule.today")}</Badge></span>}</p>
                      <p className="shrink-0 text-[var(--text-small)] text-[var(--color-text-secondary)]">{formatHours(day.minutes, lang)}</p>
                    </div>
                    {day.shiftIds.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("mySchedule.noShifts")}</p> : (
                      <ul className="flex flex-col gap-2">
                        {day.shiftIds.map((id) => shiftsById.get(id)).filter((s) => !!s).map((s) => {
                          const startsToday = s!.startsAt.slice(0, 10) === day.date;
                          const endsToday = s!.endsAt.slice(0, 10) === day.date;
                          return (
                            <li key={s!.shiftId}>
                              <Link to={`/caregiver/shifts/${s!.shiftId}`} className="flex min-h-11 flex-col gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3 text-[var(--text-small)]" data-testid="my-schedule-shift">
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {`${startsToday ? timeOf(s!.startsAt) : t("mySchedule.fromPreviousDay")}–${endsToday ? timeOf(s!.endsAt) : t("mySchedule.untilNextDay", { time: timeOf(s!.endsAt) })}`}
                                  <span className="text-[var(--color-text-secondary)]"> · {formatHours(s!.durationMinutes, lang)}</span>
                                </span>
                                <span className="text-[var(--color-text-primary)]">{s!.establishmentName ?? t("mySchedule.establishmentFallback")}{s!.roomName ? ` · ${t("schedule.individual.room", { name: s!.roomName })}` : ""}{s!.residentName ? ` · ${s!.residentName}` : ""}</span>
                                <span><Badge tone={s!.assignmentStatus === "accepted" ? "success" : "accent"}>{t(`schedule.assignment.${s!.assignmentStatus}`)}</Badge></span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("mySchedule.note")}</p>
          </>
        )}
    </div>
  );
}
