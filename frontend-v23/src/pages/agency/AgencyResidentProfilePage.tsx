import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, CalendarRange, ClipboardList, HeartPulse, Plus, Trash2, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listIncidents, type Incident } from "@/api/incidents";
import {
  getActiveCarePlan,
  saveCarePlan,
  supportLevelLabels,
  taskCategoryLabels,
  taskFrequencyLabels,
  type CarePlan,
  type CarePlanSupportLevel,
  type CarePlanTaskCategory,
  type CarePlanTaskFrequency,
  type CarePlanTaskPriority,
} from "@/api/carePlans";
import { getCareRecipient, recipientName, type CareRecipient } from "@/api/shifts";
import { Badge, BottomSheet, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, StatusBadge, Textarea, Timeline, useToast } from "@/components/ui";
import { useAgencySupervision } from "@/features/agency/useAgencySupervision";
import { updateCareRecipient } from "@/api/roster";
import { AccessInvitationPanel } from "./AccessInvitationPanel";

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

interface CarePlanTaskDraft {
  id?: string;
  title: string;
  details: string;
  category: CarePlanTaskCategory;
  frequency: CarePlanTaskFrequency;
  timeOfDay: string;
  priority: CarePlanTaskPriority;
  requiresConfirmation: boolean;
}

interface CarePlanFormState {
  supportLevel: CarePlanSupportLevel;
  goals: string;
  instructions: string;
  precautions: string;
  tasks: CarePlanTaskDraft[];
}

const emptyTask = (): CarePlanTaskDraft => ({
  title: "",
  details: "",
  category: "OTHER",
  frequency: "EVERY_SHIFT",
  timeOfDay: "",
  priority: "ROUTINE",
  requiresConfirmation: true,
});

const emptyCarePlanForm = (): CarePlanFormState => ({
  supportLevel: "MODERATE",
  goals: "",
  instructions: "",
  precautions: "",
  tasks: [],
});

function lines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function priorityLabel(priority: CarePlanTaskPriority): string {
  if (priority === "CRITICAL") return "Crítica";
  if (priority === "IMPORTANT") return "Importante";
  return "Rutinaria";
}

export function AgencyResidentProfilePage() {
  const { residentId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const supervision = useAgencySupervision();
  const [resident, setResident] = useState<CareRecipient | null | undefined>(undefined);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [carePlan, setCarePlan] = useState<CarePlan | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planForm, setPlanForm] = useState<CarePlanFormState>(emptyCarePlanForm);
  const [form, setForm] = useState({ firstName: "", lastName: "", preferredName: "", dateOfBirth: "", allergies: "" });
  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !residentId || !token) return;
    setError(false);
    try {
      const [recipientRow, incidentRows, carePlanRow] = await Promise.all([
        getCareRecipient(organizationId, residentId, token),
        listIncidents(organizationId, token),
        getActiveCarePlan(organizationId, residentId, token),
      ]);
      setResident(recipientRow);
      setIncidents(incidentRows.filter((incident) => incident.care_recipient_id === residentId));
      setCarePlan(carePlanRow);
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

  const openPlanEditor = () => {
    if (!carePlan) {
      setPlanForm(emptyCarePlanForm());
    } else {
      setPlanForm({
        supportLevel: carePlan.plan_details.supportLevel,
        goals: carePlan.plan_details.goals.join("\n"),
        instructions: carePlan.plan_details.instructions.join("\n"),
        precautions: carePlan.plan_details.precautions.join("\n"),
        tasks: carePlan.plan_details.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          details: task.details ?? "",
          category: task.category,
          frequency: task.frequency,
          timeOfDay: task.timeOfDay ?? "",
          priority: task.priority,
          requiresConfirmation: task.requiresConfirmation,
        })),
      });
    }
    setPlanEditing(true);
  };

  const updateTask = (index: number, patch: Partial<CarePlanTaskDraft>) => {
    setPlanForm((current) => ({
      ...current,
      tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task),
    }));
  };

  const savePlan = async () => {
    const token = getToken();
    if (!organizationId || !residentId || !token) return;
    const validTasks = planForm.tasks.filter((task) => task.title.trim());
    setPlanSaving(true);
    try {
      const saved = await saveCarePlan(organizationId, residentId, {
        supportLevel: planForm.supportLevel,
        goals: lines(planForm.goals),
        instructions: lines(planForm.instructions),
        precautions: lines(planForm.precautions),
        tasks: validTasks.map((task) => ({
          ...(task.id ? { id: task.id } : {}),
          title: task.title.trim(),
          ...(task.details.trim() ? { details: task.details.trim() } : {}),
          category: task.category,
          frequency: task.frequency,
          ...(task.timeOfDay ? { timeOfDay: task.timeOfDay } : {}),
          priority: task.priority,
          requiresConfirmation: task.requiresConfirmation,
        })),
      }, token);
      setCarePlan(saved);
      setPlanEditing(false);
      toast.show(carePlan ? "Nueva versión del plan guardada." : "Plan de cuidado creado.", "success");
    } catch {
      toast.show("No pudimos guardar el plan de cuidado.", "danger");
    } finally {
      setPlanSaving(false);
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
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={21} />
            <div>
              <h2 className="font-medium text-[var(--color-text-primary)]">Plan individual de cuidado</h2>
              {carePlan && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mt-0.5">Versión {carePlan.version} · vigente desde {new Date(carePlan.effective_from).toLocaleDateString("es-PR")}</p>}
            </div>
          </div>
          <Button variant="secondary" onClick={openPlanEditor}>{carePlan ? "Actualizar plan" : "Crear plan"}</Button>
        </div>
        {carePlan === undefined ? <Skeleton className="h-28" /> : !carePlan ? (
          <EmptyState icon={<ClipboardList size={28} />} title="Este residente todavía no tiene un plan de cuidado." />
        ) : (
          <div className="flex flex-col gap-4">
            <div><Badge tone={carePlan.plan_details.supportLevel === "COMPLEX" || carePlan.plan_details.supportLevel === "HIGH" ? "warning" : "accent"}>{supportLevelLabels[carePlan.plan_details.supportLevel]}</Badge></div>
            <PlanList title="Objetivos" items={carePlan.plan_details.goals} empty="Sin objetivos registrados." />
            <PlanList title="Instrucciones" items={carePlan.plan_details.instructions} empty="Sin instrucciones registradas." />
            <PlanList title="Precauciones" items={carePlan.plan_details.precautions} empty="Sin precauciones registradas." />
            <div>
              <p className="text-[var(--text-caption)] text-[var(--color-text-muted)] mb-2">Tareas del cuidado</p>
              {carePlan.plan_details.tasks.length === 0 ? <p className="text-[var(--text-small)] text-[var(--color-text-primary)]">Sin tareas registradas.</p> : (
                <div className="flex flex-col gap-2">
                  {carePlan.plan_details.tasks.map((task) => (
                    <div key={task.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium text-[var(--color-text-primary)]">{task.title}</p><Badge tone={task.priority === "CRITICAL" ? "danger" : task.priority === "IMPORTANT" ? "warning" : "neutral"}>{priorityLabel(task.priority)}</Badge></div>
                      <p className="text-[var(--text-caption)] text-[var(--color-text-secondary)] mt-1">{taskCategoryLabels[task.category]} · {taskFrequencyLabels[task.frequency]}{task.timeOfDay ? ` · ${task.timeOfDay}` : ""}</p>
                      {task.details && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">{task.details}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {organizationId && residentId && resident.status === "active" && (
        <AccessInvitationPanel organizationId={organizationId} type="family" careRecipientId={residentId} />
      )}

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

      <BottomSheet
        open={planEditing}
        onClose={() => !planSaving && setPlanEditing(false)}
        title={carePlan ? "Actualizar plan de cuidado" : "Crear plan de cuidado"}
        footer={<><Button variant="secondary" fullWidth disabled={planSaving} onClick={() => setPlanEditing(false)}>Cancelar</Button><Button fullWidth loading={planSaving} onClick={() => void savePlan()}>Guardar plan</Button></>}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Cada guardado crea una nueva versión y conserva el historial anterior.</p>
          <Select label="Nivel de apoyo" value={planForm.supportLevel} onChange={(event) => setPlanForm((current) => ({ ...current, supportLevel: event.target.value as CarePlanSupportLevel }))}>
            {Object.entries(supportLevelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Textarea label="Objetivos" hint="Escribe un objetivo por línea." value={planForm.goals} onChange={(event) => setPlanForm((current) => ({ ...current, goals: event.target.value }))} placeholder="Mantener movilidad segura" />
          <Textarea label="Instrucciones" hint="Escribe una instrucción por línea." value={planForm.instructions} onChange={(event) => setPlanForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Hablar despacio y confirmar comprensión" />
          <Textarea label="Precauciones" hint="Escribe una precaución por línea." value={planForm.precautions} onChange={(event) => setPlanForm((current) => ({ ...current, precautions: event.target.value }))} placeholder="Riesgo de caída" />

          <div className="flex items-center justify-between gap-3">
            <div><p className="font-medium text-[var(--color-text-primary)]">Tareas</p><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Define lo que debe realizarse durante el cuidado.</p></div>
            <Button type="button" variant="secondary" icon={<Plus size={18} />} onClick={() => setPlanForm((current) => ({ ...current, tasks: [...current.tasks, emptyTask()] }))}>Añadir</Button>
          </div>
          {planForm.tasks.map((task, index) => (
            <div key={task.id ?? `new-${index}`} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2"><p className="font-medium text-[var(--color-text-primary)]">Tarea {index + 1}</p><Button type="button" variant="ghost" icon={<Trash2 size={17} />} onClick={() => setPlanForm((current) => ({ ...current, tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index) }))}>Quitar</Button></div>
              <Input label="Tarea" value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} placeholder="Ej. Ofrecer un vaso de agua" required />
              <Textarea label="Detalles (opcional)" value={task.details} onChange={(event) => updateTask(index, { details: event.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Categoría" value={task.category} onChange={(event) => updateTask(index, { category: event.target.value as CarePlanTaskCategory })}>
                  {Object.entries(taskCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Select label="Frecuencia" value={task.frequency} onChange={(event) => updateTask(index, { frequency: event.target.value as CarePlanTaskFrequency })}>
                  {Object.entries(taskFrequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
                <Input label="Hora sugerida (opcional)" type="time" value={task.timeOfDay} onChange={(event) => updateTask(index, { timeOfDay: event.target.value })} />
                <Select label="Prioridad" value={task.priority} onChange={(event) => updateTask(index, { priority: event.target.value as CarePlanTaskPriority })}>
                  <option value="ROUTINE">Rutinaria</option><option value="IMPORTANT">Importante</option><option value="CRITICAL">Crítica</option>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

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

function PlanList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <div><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{title}</p>{items.length ? <ul className="list-disc pl-5 mt-1 text-[var(--text-small)] text-[var(--color-text-primary)] space-y-1">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{empty}</p>}</div>;
}
