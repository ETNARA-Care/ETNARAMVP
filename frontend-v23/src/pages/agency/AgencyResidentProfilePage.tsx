import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, CalendarRange, HeartPulse, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listIncidents, type Incident } from "@/api/incidents";
import { getCareRecipient, recipientName, type CareRecipient } from "@/api/shifts";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, StatusBadge, Timeline, useToast } from "@/components/ui";
import { useAgencySupervision } from "@/features/agency/useAgencySupervision";
import { updateCareRecipient } from "@/api/roster";

const careLabels: Record<string, string> = {
  MEAL: "Comida",
  HYDRATION: "Hidratación",
  TOILETING: "Baño / aseo",
  MOBILITY: "Movilidad",
  ACTIVITY: "Actividad",
  MOOD: "Estado de ánimo",
  NOTE: "Observación",
};

function valuesFromRecord(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
    const label = key.replaceAll("_", " ");
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") return `${label}: ${String(entry)}`;
    return label;
  });
}

export function AgencyResidentProfilePage() {
  const { residentId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const supervision = useAgencySupervision();
  const [resident, setResident] = useState<CareRecipient | null | undefined>(undefined);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", preferredName: "", dateOfBirth: "", allergies: "" });
  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !residentId || !token) return;
    setError(false);
    try {
      const [recipientRow, incidentRows] = await Promise.all([
        getCareRecipient(organizationId, residentId, token),
        listIncidents(organizationId, token),
      ]);
      setResident(recipientRow);
      setIncidents(incidentRows.filter((incident) => incident.care_recipient_id === residentId));
    } catch {
      setResident(null);
      setError(true);
    }
  }, [organizationId, residentId]);

  useEffect(() => { void load(); }, [load]);

  const openEdit = () => {
    if (!resident) return;
    setForm({
      firstName: resident.first_name,
      lastName: resident.last_name,
      preferredName: resident.preferred_name ?? "",
      dateOfBirth: resident.date_of_birth ?? "",
      allergies: resident.allergies?.join(", ") ?? "",
    });
    setEditing(true);
  };

  const saveResident = async () => {
    const token = getToken();
    if (!organizationId || !residentId || !token || !form.firstName.trim() || !form.lastName.trim()) return;
    setSaving(true);
    try {
      const updated = await updateCareRecipient(organizationId, residentId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        preferredName: form.preferredName.trim() || null,
        dateOfBirth: form.dateOfBirth || null,
        allergies: form.allergies.trim() ? form.allergies.split(",").map((item) => item.trim()).filter(Boolean) : [],
      }, token);
      setResident(updated);
      setEditing(false);
      toast.show("Información del residente actualizada.", "success");
    } catch {
      toast.show("No pudimos actualizar al residente.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    const token = getToken();
    if (!organizationId || !residentId || !resident || !token) return;
    const nextStatus = resident.status === "active" ? "archived" : "active";
    setSaving(true);
    try {
      const updated = await updateCareRecipient(organizationId, residentId, { status: nextStatus }, token);
      setResident(updated);
      setConfirmingStatus(false);
      toast.show(nextStatus === "active" ? "Residente reactivado." : "Residente archivado; su historial se conserva.", "success");
    } catch {
      toast.show("No pudimos cambiar el estado del residente.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const shifts = useMemo(
    () => supervision.shifts.filter((shift) => shift.care_recipient_id === residentId).sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()),
    [residentId, supervision.shifts],
  );
  const events = useMemo(
    () => supervision.events.filter((event) => event.care_recipient_id === residentId).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 10),
    [residentId, supervision.events],
  );

  if (resident === undefined || supervision.loading) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  if (error || supervision.error) return <ErrorState kind="server" onRetry={() => { void load(); void supervision.reload(); }} />;
  if (!resident) return <ErrorState kind="not_found" />;

  const activeShift = shifts.find((shift) => shift.status === "in_progress") ?? shifts.find((shift) => shift.status === "confirmed") ?? shifts[0];
  const preferenceItems = valuesFromRecord(resident.preferences);
  const routineItems = valuesFromRecord(resident.routines);
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate(-1)} className="self-start">Volver</Button>
      <PageHeader
        title={recipientName(resident)}
        description="Perfil operacional del residente con información real de cuidado."
        actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={openEdit}>Editar</Button><Button variant={resident.status === "active" ? "danger" : "primary"} onClick={() => setConfirmingStatus(true)}>{resident.status === "active" ? "Archivar" : "Reactivar"}</Button></div>}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2 mb-4"><UserRound size={21} /><h2 className="font-medium text-[var(--color-text-primary)]">Información básica</h2></div>
          <dl className="flex flex-col gap-3">
            <ProfileField label="Nombre legal" value={`${resident.first_name} ${resident.last_name}`.trim()} />
            <ProfileField label="Fecha de nacimiento" value={resident.date_of_birth ? new Date(`${resident.date_of_birth}T00:00:00`).toLocaleDateString("es-PR", { dateStyle: "long" }) : "No registrada"} />
            <ProfileField label="Habitación" value={resident.room_id || "No asignada"} />
            <ProfileField label="Estado" value={resident.status === "active" ? "Activo" : "Archivado"} />
          </dl>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-4"><HeartPulse size={21} /><h2 className="font-medium text-[var(--color-text-primary)]">Información de cuidado</h2></div>
          <ProfileField label="Alergias" value={resident.allergies?.length ? resident.allergies.join(", ") : "No registradas"} />
          <ListField label="Preferencias" items={preferenceItems} />
          <ListField label="Rutinas" items={routineItems} />
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4"><CalendarRange size={21} /><h2 className="font-medium text-[var(--color-text-primary)]">Turno y cuidadora</h2></div>
        {!activeShift ? <p className="text-[var(--text-small)] text-[var(--color-text-muted)]">No hay turnos registrados.</p> : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[var(--color-text-primary)]">{activeShift.caregiver?.display_name || activeShift.caregiver?.internal_role || "Sin cuidadora asignada"}</p>
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">
                {new Date(activeShift.scheduled_start).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })} – {new Date(activeShift.scheduled_end).toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
            <StatusBadge status={activeShift.status} />
          </div>
        )}
      </Card>

      <div>
        <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)] mb-3">Incidentes abiertos</h2>
        {openIncidents.length === 0 ? <EmptyState icon={<AlertTriangle size={28} />} title="No hay incidentes abiertos." /> : (
          <div className="flex flex-col gap-2">
            {openIncidents.map((incident) => (
              <button key={incident.id} type="button" className="text-left" onClick={() => navigate(`/agency/incidents/${incident.id}`)}>
                <Card className="flex items-start justify-between gap-3 hover:bg-[var(--color-ivory-100)] transition-colors">
                  <div><p className="font-medium text-[var(--color-text-primary)]">{incident.description}</p><p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-1">{new Date(incident.created_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}</p></div>
                  <Badge tone="danger">{incident.severity}</Badge>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)] mb-3">Actividad reciente</h2>
        {events.length === 0 ? <EmptyState icon={<Activity size={28} />} title="No hay actividad registrada todavía." /> : (
          <Timeline entries={events.map((event) => ({
            id: event.id,
            time: new Date(event.occurred_at).toLocaleString("es-PR", { dateStyle: "short", timeStyle: "short" }),
            title: `${careLabels[event.type_code] ?? event.type_code}${event.note_text ? `: ${event.note_text}` : ""}${event.caregiver?.display_name ? ` · ${event.caregiver.display_name}` : ""}`,
          }))} />
        )}
      </div>

      <Modal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        title="Editar residente"
        footer={<><Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveResident()} loading={saving} disabled={!form.firstName.trim() || !form.lastName.trim()}>Guardar cambios</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Nombre" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required />
          <Input label="Apellidos" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required />
          <Input label="Nombre preferido (opcional)" value={form.preferredName} onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))} />
          <Input label="Fecha de nacimiento (opcional)" type="date" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} />
          <Input label="Alergias (opcional)" hint="Separa varias alergias con comas." value={form.allergies} onChange={(event) => setForm((current) => ({ ...current, allergies: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={confirmingStatus}
        onClose={() => !saving && setConfirmingStatus(false)}
        title={resident.status === "active" ? "Archivar residente" : "Reactivar residente"}
        footer={<><Button variant="secondary" onClick={() => setConfirmingStatus(false)} disabled={saving}>Volver</Button><Button variant={resident.status === "active" ? "danger" : "primary"} onClick={() => void changeStatus()} loading={saving}>{resident.status === "active" ? "Sí, archivar" : "Sí, reactivar"}</Button></>}
      >
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">{resident.status === "active" ? "El residente dejará de aparecer como activo, pero sus turnos, incidentes y actividades permanecerán en el historial." : "El residente volverá a estar disponible para la operación y nuevas asignaciones."}</p>
      </Modal>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</dt><dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1 break-words">{value}</dd></div>;
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return <div className="mt-3"><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</p>{items.length ? <ul className="list-disc pl-5 mt-1 text-[var(--text-small)] text-[var(--color-text-primary)]">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">No registradas</p>}</div>;
}
