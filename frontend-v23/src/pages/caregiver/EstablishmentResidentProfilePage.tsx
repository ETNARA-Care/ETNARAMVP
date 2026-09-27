import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { getEstablishmentWorkspace, updateManagedResident, type EstablishmentWorkspace } from "@/api/establishments";
import { Button, Card, ErrorState, Input, PageHeader, Select, Skeleton, useToast } from "@/components/ui";

type ResidentStatus = "active" | "inactive";

export function EstablishmentResidentProfilePage() {
  const { establishmentId = "", residentId = "" } = useParams();
  const { activeOrganization } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [workspace, setWorkspace] = useState<EstablishmentWorkspace | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ firstName: string; lastName: string; preferredName: string; status: ResidentStatus }>({ firstName: "", lastName: "", preferredName: "", status: "active" });

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !activeOrganization?.id || !establishmentId) return;
    try {
      setWorkspace(await getEstablishmentWorkspace(activeOrganization.id, establishmentId, token));
      setError(false);
    } catch { setError(true); }
  }, [activeOrganization?.id, establishmentId]);

  useEffect(() => { void load(); }, [load]);
  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!workspace) return <Skeleton className="h-40" />;
  const resident = workspace.residents.find((row) => row.id === residentId);
  if (!resident) return <ErrorState kind="not_found" />;

  const openEdit = () => {
    setForm({
      firstName: resident.first_name ?? "",
      lastName: resident.last_name ?? "",
      preferredName: resident.preferred_name ?? "",
      status: resident.status === "inactive" ? "inactive" : "active",
    });
    setEditing(true);
  };

  const save = async () => {
    const token = getToken();
    if (!token || !activeOrganization?.id || !form.firstName.trim() || !form.lastName.trim()) return;
    setSaving(true);
    try {
      await updateManagedResident(activeOrganization.id, establishmentId, residentId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        preferredName: form.preferredName.trim() || null,
        status: form.status,
      }, token);
      setEditing(false);
      await load();
      toast.show("Residente actualizado.", "success");
    } catch {
      toast.show("No pudimos actualizar al residente.", "danger");
    } finally { setSaving(false); }
  };

  return <div className="flex flex-col gap-5">
    <button onClick={() => navigate(`/caregiver/admin/establishments/${establishmentId}`)} className="flex items-center gap-2"><ArrowLeft size={17}/>Volver a {workspace.establishment.name}</button>
    <PageHeader title={`${resident.first_name} ${resident.last_name}`} description="Expediente del residente del establecimiento" />
    {editing ? <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><UserRound size={20}/><b>Editar residente</b></div>
      <Input label="Nombre" value={form.firstName} onChange={(e) => setForm(v => ({...v, firstName:e.target.value}))}/>
      <Input label="Apellidos" value={form.lastName} onChange={(e) => setForm(v => ({...v, lastName:e.target.value}))}/>
      <Input label="Nombre preferido" value={form.preferredName} onChange={(e) => setForm(v => ({...v, preferredName:e.target.value}))}/>
      <Select label="Estado" value={form.status} onChange={(e) => setForm(v => ({...v,status:e.target.value as ResidentStatus}))}><option value="active">Activo</option><option value="inactive">Inactivo</option></Select>
      <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button><Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button></div>
    </Card> : <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2"><UserRound size={20}/><b>Información del residente</b></div>
      <p><b>Nombre:</b> {resident.first_name} {resident.last_name}</p>
      {resident.preferred_name ? <p><b>Nombre preferido:</b> {resident.preferred_name}</p> : null}
      <p><b>Estado:</b> {resident.status === "active" ? "Activo" : "Inactivo"}</p>
      <Button onClick={openEdit}>Editar residente</Button>
    </Card>}
    <Card className="flex flex-col gap-2">
      <b>Expediente y cuidado</b>
      <p className="text-sm text-[var(--color-text-muted)]">La información clínica, documentos, plan de cuidado e historial se conectarán aquí con alcance exclusivo de {workspace.establishment.name}, sin exponer residentes de otros establecimientos.</p>
    </Card>
  </div>;
}
