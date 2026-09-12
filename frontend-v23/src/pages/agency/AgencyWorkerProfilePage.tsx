import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getWorkerProfile, listWorkers, type WorkerCredentialSummary, type WorkerMembership } from "@/api/shifts";
import { updateWorker } from "@/api/roster";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { WorkerCredentialBadge } from "./WorkerCredentialBadge";
import { formatCredentialDate } from "./workerCredentialUtils";

export function AgencyWorkerProfilePage() {
  const { membershipId } = useParams();
  const navigate = useNavigate();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const [worker, setWorker] = useState<WorkerMembership | null | undefined>(undefined);
  const [credentials, setCredentials] = useState<WorkerCredentialSummary[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ displayName: "", internalRole: "CNA", hiredAt: "" });
  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !token) return;
    setError(false);
    try {
      const [workers, profile] = await Promise.all([
        listWorkers(organizationId, token),
        getWorkerProfile(organizationId, membershipId, token),
      ]);
      setWorker(workers.find((row) => row.id === membershipId) ?? null);
      setCredentials(profile.credentialsSummary);
    } catch {
      setWorker(null);
      setError(true);
    }
  }, [membershipId, organizationId]);

  useEffect(() => { void load(); }, [load]);

  const openEdit = () => {
    if (!worker) return;
    setForm({
      displayName: worker.display_name ?? "",
      internalRole: worker.internal_role,
      hiredAt: worker.hired_at?.slice(0, 10) ?? "",
    });
    setEditing(true);
  };

  const saveWorker = async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !token || !form.displayName.trim() || !form.internalRole.trim()) return;
    setSaving(true);
    try {
      const updated = await updateWorker(organizationId, membershipId, {
        displayName: form.displayName.trim(),
        internalRole: form.internalRole,
        hiredAt: form.hiredAt || null,
      }, token);
      setWorker((current) => current ? { ...current, ...updated } : current);
      setEditing(false);
      toast.show("Información del personal actualizada.", "success");
    } catch {
      toast.show("No pudimos actualizar la información.", "danger");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    const token = getToken();
    if (!organizationId || !membershipId || !worker || !token) return;
    const active = worker.status !== "active";
    setSaving(true);
    try {
      const updated = await updateWorker(organizationId, membershipId, {
        status: active ? "active" : "inactive",
        endedAt: active ? null : new Date().toISOString(),
      }, token);
      setWorker((current) => current ? { ...current, ...updated } : current);
      setConfirmingStatus(false);
      toast.show(active ? "Personal reactivado." : "Personal desactivado; su historial se conserva.", "success");
    } catch {
      toast.show("No pudimos cambiar el estado del personal.", "danger");
    } finally {
      setSaving(false);
    }
  };

  if (worker === undefined) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-56" /></div>;
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!worker) return <ErrorState kind="not_found" />;

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <Button variant="ghost" icon={<ArrowLeft size={18} />} onClick={() => navigate("/agency/workers")} className="self-start">Volver a cuidadores</Button>
      <PageHeader
        title={worker.display_name || "Cuidador sin nombre"}
        description="Información laboral y credenciales verificadas."
        actions={<div className="flex flex-wrap items-center gap-2"><Badge tone={worker.status === "active" ? "success" : "neutral"}>{worker.status === "active" ? "Activo" : "Inactivo"}</Badge><Button variant="secondary" onClick={openEdit}>Editar</Button><Button variant={worker.status === "active" ? "danger" : "primary"} onClick={() => setConfirmingStatus(true)}>{worker.status === "active" ? "Desactivar" : "Reactivar"}</Button></div>}
      />

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <BriefcaseBusiness size={20} className="text-[var(--color-text-muted)]" aria-hidden />
          <h2 className="font-medium text-[var(--color-text-primary)]">Información laboral</h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Rol interno" value={worker.internal_role} />
          <Detail label="Estado" value={worker.status === "active" ? "Activo" : "Inactivo"} />
          <Detail label="Fecha de contratación" value={worker.hired_at ? formatCredentialDate(worker.hired_at.slice(0, 10)) : "No registrada"} />
          {worker.ended_at && <Detail label="Fecha de finalización" value={new Date(worker.ended_at).toLocaleDateString("es-PR")} />}
        </dl>
      </Card>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={21} className="text-[var(--color-text-muted)]" aria-hidden />
          <h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Credenciales</h2>
        </div>
        {credentials.length === 0 ? (
          <EmptyState title="Sin credenciales registradas" />
        ) : (
          <div className="flex flex-col gap-2">
            {credentials.map((credential) => (
              <Card key={credential.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{credential.type_code}</p>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">{credential.expires_at ? `Expira ${formatCredentialDate(credential.expires_at)}` : "Sin fecha de expiración"}</p>
                </div>
                <WorkerCredentialBadge credential={credential} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={editing}
        onClose={() => !saving && setEditing(false)}
        title="Editar personal"
        footer={<><Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void saveWorker()} loading={saving} disabled={!form.displayName.trim() || !form.internalRole.trim()}>Guardar cambios</Button></>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Nombre completo" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required />
          <Select label="Clasificación laboral" value={form.internalRole} onChange={(event) => setForm((current) => ({ ...current, internalRole: event.target.value }))} required>
            <option value="CNA">CNA</option><option value="HHA">HHA</option><option value="RN">RN</option><option value="LPN">LPN</option><option value="SUPERVISOR">Supervisor/a</option><option value="OTRO">Otro</option>
          </Select>
          <Input label="Fecha de contratación (opcional)" type="date" value={form.hiredAt} onChange={(event) => setForm((current) => ({ ...current, hiredAt: event.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={confirmingStatus}
        onClose={() => !saving && setConfirmingStatus(false)}
        title={worker.status === "active" ? "Desactivar personal" : "Reactivar personal"}
        footer={<><Button variant="secondary" onClick={() => setConfirmingStatus(false)} disabled={saving}>Volver</Button><Button variant={worker.status === "active" ? "danger" : "primary"} onClick={() => void changeStatus()} loading={saving}>{worker.status === "active" ? "Sí, desactivar" : "Sí, reactivar"}</Button></>}
      >
        <p className="text-[var(--text-body)] text-[var(--color-text-secondary)]">{worker.status === "active" ? "La persona dejará de estar disponible para nuevas asignaciones. Sus turnos, credenciales y actividad permanecerán en el historial." : "La persona volverá a estar disponible para la operación y nuevas asignaciones."}</p>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{label}</dt><dd className="text-[var(--text-small)] text-[var(--color-text-primary)] mt-1">{value}</dd></div>;
}
