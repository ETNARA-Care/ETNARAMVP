import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getEstablishmentWorkspace, updateManagedPerson, type EstablishmentWorkspace } from "@/api/establishments";
import { Button, Card, ErrorState, Input, PageHeader, Select, Skeleton, useToast } from "@/components/ui";

type WorkerStatus = "active" | "inactive";

export function EstablishmentWorkerProfilePage() {
  const { establishmentId = "", membershipId = "" } = useParams();
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const editRef = useRef<HTMLDivElement | null>(null);
  const [workspace, setWorkspace] = useState<EstablishmentWorkspace | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ displayName: string; internalRole: string; status: WorkerStatus }>({ displayName: "", internalRole: "CAREGIVER", status: "active" });

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !activeOrganization?.id || !establishmentId) return;
    try {
      setWorkspace(await getEstablishmentWorkspace(activeOrganization.id, establishmentId, token));
      setError(false);
    } catch {
      setError(true);
    }
  }, [activeOrganization?.id, establishmentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (editing) requestAnimationFrame(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [editing]);

  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!workspace) return <Skeleton className="h-40" />;
  const worker = workspace.personnel.find((row) => row.membership_id === membershipId);
  if (!worker) return <ErrorState kind="not_found" />;

  const openEdit = () => {
    const status: WorkerStatus = worker.status === "inactive" ? "inactive" : "active";
    setForm({ displayName: worker.display_name ?? "", internalRole: worker.role ?? "CAREGIVER", status });
    setEditing(true);
  };

  const save = async () => {
    const token = getToken();
    if (!token || !activeOrganization?.id) return;
    setSaving(true);
    try {
      await updateManagedPerson(activeOrganization.id, establishmentId, membershipId, {
        displayName: form.displayName.trim(),
        internalRole: form.internalRole,
        status: form.status,
      }, token);
      setEditing(false);
      await load();
      toast.show("Personal actualizado.", "success");
    } catch {
      toast.show("No pudimos actualizar el personal.", "danger");
    } finally { setSaving(false); }
  };

  return <div className="flex flex-col gap-5">
    <button onClick={() => navigate(`/caregiver/admin/establishments/${establishmentId}`)} className="flex items-center gap-2"><ArrowLeft size={17}/>Volver a De La Vega Home</button>
    <PageHeader title={worker.display_name || "Personal"} description="Expediente del personal del establecimiento" />

    {editing ? <div ref={editRef}>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2"><BriefcaseBusiness size={20}/><b>Editar personal</b></div>
        <Input label="Nombre" value={form.displayName} onChange={(e) => setForm(v => ({...v, displayName:e.target.value}))}/>
        <Input label="Rol" value={form.internalRole} onChange={(e) => setForm(v => ({...v, internalRole:e.target.value}))}/>
        <Select label="Estado" value={form.status} onChange={(e) => setForm(v => ({...v,status:e.target.value as WorkerStatus}))}><option value="active">Activo</option><option value="inactive">Inactivo</option></Select>
        <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button><Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button></div>
      </Card>
    </div> : <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><BriefcaseBusiness size={20}/><b>Información laboral</b></div>
      <p>Rol: {worker.role || "Personal"}</p><p>Estado: {worker.status === "active" ? "Activo" : worker.status}</p>
      <Button onClick={openEdit}>Editar personal</Button>
    </Card>}

    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2"><ShieldCheck size={20}/><b>Credenciales y acceso</b></div>
      <p className="text-sm text-[var(--color-text-muted)]">Este expediente permanece limitado a este establecimiento. Las credenciales, documentos e invitaciones se habilitarán aquí únicamente mediante endpoints con alcance de establecimiento; no se usarán permisos globales de la organización.</p>
    </Card>
  </div>;
}
