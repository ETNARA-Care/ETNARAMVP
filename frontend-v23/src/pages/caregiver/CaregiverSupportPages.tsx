import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, Avatar, Badge, Button, Checkbox, Input, Skeleton, useToast } from "@/components/ui";
import { CalendarClock, CheckCircle2, LogOut, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { RealMessagingPanel } from "@/features/messaging/ConversationUI";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listMyCredentials, type CredentialSummary } from "@/api/credentials";
import { getMyAvailability, saveMyAvailability, type MyAvailability } from "@/api/availability";

const weekdays = [
  { value: 1, label: "Lunes" }, { value: 2, label: "Martes" }, { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" }, { value: 5, label: "Viernes" }, { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

interface AvailabilityDayDraft {
  weekday: number;
  label: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface TimeOffDraft {
  key: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

function emptyAvailabilityDays(): AvailabilityDayDraft[] {
  return weekdays.map((day) => ({ ...day, weekday: day.value, enabled: false, startTime: "08:00", endTime: "17:00" }));
}

function localDateTime(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function credentialState(credential: CredentialSummary): { tone: "success" | "warning" | "danger"; label: string } {
  if (credential.status === "expired") return { tone: "danger", label: "Vencida" };
  if (credential.verificationStatus === "rejected") return { tone: "danger", label: "Rechazada" };
  if (credential.verificationStatus === "pending") return { tone: "warning", label: "Pendiente" };
  if (credential.expiresAt) {
    const days = Math.ceil((new Date(`${credential.expiresAt}T23:59:59`).getTime() - Date.now()) / 86_400_000);
    if (days <= 60) return { tone: "warning", label: "Por vencer" };
  }
  return { tone: "success", label: "Vigente" };
}

export function CaregiverMessagesPage() {
  return (
    <div>
      <PageHeader title="Mensajes" />
      <RealMessagingPanel />
    </div>
  );
}

export function CaregiverProfilePage() {
  const { user, activeOrganization, logout } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<CredentialSummary[] | null>(null);
  const [credentialError, setCredentialError] = useState(false);
  const [availability, setAvailability] = useState<MyAvailability | null>(null);
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDayDraft[]>(emptyAvailabilityDays);
  const [timeOff, setTimeOff] = useState<TimeOffDraft[]>([]);
  const [timeOffForm, setTimeOffForm] = useState({ startsAt: "", endsAt: "", reason: "" });
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const { show } = useToast();

  const loadCredentials = useCallback(async () => {
    const token = getToken();
    if (!token || !activeOrganization) return;
    setCredentialError(false);
    try {
      setCredentials(await listMyCredentials(activeOrganization.id, token));
    } catch {
      setCredentialError(true);
      setCredentials([]);
    }
  }, [activeOrganization]);

  useEffect(() => { void loadCredentials(); }, [loadCredentials]);

  const loadAvailability = useCallback(async () => {
    const token = getToken();
    if (!token || !activeOrganization) return;
    setAvailabilityError(false);
    try {
      const result = await getMyAvailability(activeOrganization.id, token);
      setAvailability(result);
      setAvailabilityDays(weekdays.map((day) => {
        const window = result.weeklyWindows.find((item) => item.weekday === day.value);
        return { ...day, weekday: day.value, enabled: Boolean(window), startTime: window?.startTime ?? "08:00", endTime: window?.endTime ?? "17:00" };
      }));
      setTimeOff(result.unavailablePeriods.map((period) => ({
        key: period.id ?? `${period.startsAt}-${period.endsAt}`,
        startsAt: localDateTime(period.startsAt),
        endsAt: localDateTime(period.endsAt),
        reason: period.reason ?? "",
      })));
    } catch {
      setAvailabilityError(true);
    }
  }, [activeOrganization]);

  useEffect(() => { void loadAvailability(); }, [loadAvailability]);

  function updateAvailabilityDay(weekday: number, patch: Partial<AvailabilityDayDraft>) {
    setAvailabilityDays((current) => current.map((day) => day.weekday === weekday ? { ...day, ...patch } : day));
  }

  function addTimeOff() {
    const start = new Date(timeOffForm.startsAt);
    const end = new Date(timeOffForm.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      show("Verifica el comienzo y final del periodo no disponible.", "danger");
      return;
    }
    setTimeOff((current) => [...current, { key: crypto.randomUUID(), ...timeOffForm }]);
    setTimeOffForm({ startsAt: "", endsAt: "", reason: "" });
  }

  async function saveAvailability() {
    const token = getToken();
    if (!token || !activeOrganization) return;
    const invalidDay = availabilityDays.find((day) => day.enabled && day.startTime >= day.endTime);
    if (invalidDay) {
      show(`Verifica las horas de ${invalidDay.label}.`, "danger");
      return;
    }
    setAvailabilitySaving(true);
    try {
      const saved = await saveMyAvailability(activeOrganization.id, {
        timezone: "America/Puerto_Rico",
        weeklyWindows: availabilityDays.filter((day) => day.enabled).map((day) => ({
          weekday: day.weekday, startTime: day.startTime, endTime: day.endTime,
        })),
        unavailablePeriods: timeOff.map((period) => ({
          startsAt: new Date(period.startsAt).toISOString(),
          endsAt: new Date(period.endsAt).toISOString(),
          reason: period.reason.trim() || null,
        })),
      }, token);
      setAvailability(saved);
      show("Disponibilidad guardada.", "success");
    } catch {
      show("No pudimos guardar la disponibilidad.", "danger");
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <PageHeader title="Perfil" />
      <Card className="flex items-center gap-3">
        <Avatar name="María Rivera" size={48} />
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">María Rivera</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Cuidadora certificada</p>
          {user?.email && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">Sesión: {user.email}</p>}
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-[var(--color-success-700)]" />
            <p className="font-medium text-[var(--color-text-primary)]">Mis credenciales</p>
          </div>
          {credentials && credentials.some((item) => item.verificationStatus === "verified") && <Badge tone="success">Verificada</Badge>}
        </div>
        {credentials === null ? <Skeleton className="h-24" /> : credentialError ? (
          <button className="text-[var(--text-small)] text-[var(--color-danger-700)]" onClick={() => void loadCredentials()}>No pudimos cargar las credenciales. Toca para reintentar.</button>
        ) : credentials.length === 0 ? (
          <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay credenciales registradas todavía.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--color-border)]">
            {credentials.map((credential) => {
              const state = credentialState(credential);
              return (
                <div key={credential.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                  <CheckCircle2 size={18} className="text-[var(--color-success-700)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">{credential.typeName}</p>
                    {credential.expiresAt && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Vence {new Date(`${credential.expiresAt}T00:00:00`).toLocaleDateString("es-PR")}</p>}
                  </div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={20} className="text-[var(--color-accent-700)]" />
            <p className="font-medium text-[var(--color-text-primary)]">Mi disponibilidad</p>
          </div>
          {availability?.configured ? <Badge tone="success">Configurada</Badge> : <Badge tone="warning">Pendiente</Badge>}
        </div>
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mb-4">Indica cuándo puedes trabajar. Administración verá esta información al analizar la cobertura de un turno.</p>
        {availabilityError ? (
          <button className="text-[var(--text-small)] text-[var(--color-danger-700)]" onClick={() => void loadAvailability()}>No pudimos cargar la disponibilidad. Toca para reintentar.</button>
        ) : availability === null ? <Skeleton className="h-40" /> : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {availabilityDays.map((day) => (
                <div key={day.weekday} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                  <Checkbox label={day.label} checked={day.enabled} onChange={(event) => updateAvailabilityDay(day.weekday, { enabled: event.target.checked })} />
                  {day.enabled && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Input label="Desde" type="time" value={day.startTime} onChange={(event) => updateAvailabilityDay(day.weekday, { startTime: event.target.value })} />
                      <Input label="Hasta" type="time" value={day.endTime} onChange={(event) => updateAvailabilityDay(day.weekday, { endTime: event.target.value })} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--color-border)] pt-4">
              <p className="font-medium text-[var(--color-text-primary)] mb-1">Periodos no disponibles</p>
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mb-3">Añade vacaciones, citas u otros bloqueos puntuales.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input label="Comienza" type="datetime-local" value={timeOffForm.startsAt} onChange={(event) => setTimeOffForm((current) => ({ ...current, startsAt: event.target.value }))} />
                <Input label="Termina" type="datetime-local" value={timeOffForm.endsAt} onChange={(event) => setTimeOffForm((current) => ({ ...current, endsAt: event.target.value }))} />
              </div>
              <Input label="Motivo opcional" value={timeOffForm.reason} maxLength={120} onChange={(event) => setTimeOffForm((current) => ({ ...current, reason: event.target.value }))} />
              <Button variant="secondary" icon={<Plus size={18} />} onClick={addTimeOff} disabled={!timeOffForm.startsAt || !timeOffForm.endsAt}>Añadir periodo</Button>
              {timeOff.length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  {timeOff.map((period) => (
                    <div key={period.key} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-3">
                      <div>
                        <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">{new Date(period.startsAt).toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" })} – {new Date(period.endsAt).toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" })}</p>
                        {period.reason && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{period.reason}</p>}
                      </div>
                      <button type="button" aria-label="Eliminar periodo" className="h-11 w-11 inline-flex items-center justify-center text-[var(--color-danger-700)]" onClick={() => setTimeOff((current) => current.filter((item) => item.key !== period.key))}><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={() => void saveAvailability()} loading={availabilitySaving}>Guardar disponibilidad</Button>
          </div>
        )}
      </Card>
      <Button variant="secondary" icon={<LogOut size={18} />} onClick={onLogout}>Cerrar sesión</Button>
    </div>
  );
}
