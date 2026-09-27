import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Modal, PageHeader, Select, Skeleton, useToast } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { listWorkers, type WorkerMembership } from "@/api/shifts";
import { useAgencySupervision } from "@/features/agency/useAgencySupervision";
import { assignEstablishmentAdmin, assignEstablishmentResident, assignEstablishmentWorker, getEstablishmentWorkspace, type EstablishmentWorkspace } from "@/api/establishments";

type AssignmentKind = "worker" | "resident" | "admin";

export function AgencyEstablishmentPage() {
  const { establishmentId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeOrganization } = useAuth();
  const organizationId = activeOrganization?.id;
  const { recipients } = useAgencySupervision();
  const [workspace, setWorkspace] = useState<EstablishmentWorkspace | null>(null);
  const [workers, setWorkers] = useState<WorkerMembership[]>([]);
  const [error, setError] = useState(false);
  const [assignment, setAssignment] = useState<AssignmentKind | null>(null);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !establishmentId || !token) return;
    setError(false);
    try {
      const [result, team] = await Promise.all([
        getEstablishmentWorkspace(organizationId, establishmentId, token),
        listWorkers(organizationId, token),
      ]);
      setWorkspace(result);
      setWorkers(team);
    } catch { setError(true); }
  }, [organizationId, establishmentId]);

  useEffect(() => { void load(); }, [load]);

  const assignedWorkerIds = new Set(workspace?.personnel.map((item) => item.membership_id) ?? []);
  const assignedResidentIds = new Set(workspace?.residents.map((item) => item.id) ?? []);
  const assignedAdminIds = new Set(workspace?.administrators.map((item) => item.membership_id) ?? []);
  const options = assignment === "resident"
    ? recipients.filter((item) => !assignedResidentIds.has(item.id)).map((item) => ({ id: item.id, label: `${item.first_name} ${item.last_name}` }))
    : assignment === "admin"
      ? (workspace?.administratorCandidates ?? []).filter((item) => !assignedAdminIds.has(item.membership_id)).map((item) => ({ id: item.membership_id, label: `${item.display_name || item.email || "Usuario"} — ${item.role ?? "Administrador"}` }))
      : workers.filter((item) => !assignedWorkerIds.has(item.id)).map((item) => ({ id: item.id, label: `${item.display_name} — ${item.internal_role}` }));

  async function saveAssignment() {
    const token = getToken();
    if (!organizationId || !token || !selected || !assignment) return;
    setSaving(true);
    try {
      if (assignment === "worker") await assignEstablishmentWorker(organizationId, establishmentId, selected, token);
      if (assignment === "resident") await assignEstablishmentResident(organizationId, establishmentId, selected, token);
      if (assignment === "admin") await assignEstablishmentAdmin(organizationId, establishmentId, selected, token);
      setAssignment(null); setSelected(""); await load();
      toast.show("Asignación guardada correctamente.", "success");
    } catch { toast.show("No pudimos completar la asignación.", "danger"); }
    finally { setSaving(false); }
  }

  if (error) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!workspace) return <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;

  return <div className="flex flex-col gap-6">
    <div><Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate("/agency/settings")}>Volver a establecimientos</Button></div>
    <PageHeader title={workspace.establishment.name} description={`${activeOrganization?.name ?? "Organización"} · ${workspace.establishment.address || "Dirección no registrada"}`} />
    <WorkspaceSection title="Personal" icon={<Users size={20} />} action="Añadir / asignar personal" onAdd={() => setAssignment("worker")}>
      {workspace.personnel.length === 0 ? <EmptyState title="No hay personal asignado" /> : workspace.personnel.map((item) => <WorkspaceRow key={item.membership_id} title={item.display_name || "Personal"} detail={item.status} />)}
    </WorkspaceSection>
    <WorkspaceSection title="Residentes / Pacientes" icon={<UserRound size={20} />} action="Añadir / asignar residente" onAdd={() => setAssignment("resident")}>
      {workspace.residents.length === 0 ? <EmptyState title="No hay residentes asignados" /> : workspace.residents.map((item) => <WorkspaceRow key={item.id} title={`${item.first_name} ${item.last_name}`} detail={item.status} />)}
    </WorkspaceSection>
    <WorkspaceSection title="Administración" icon={<ShieldCheck size={20} />} action="Añadir administrador" onAdd={() => setAssignment("admin")}>
      {workspace.administrators.length === 0 ? <EmptyState title="No hay administradores asignados" /> : workspace.administrators.map((item) => <WorkspaceRow key={item.membership_id} title={item.display_name || item.email || "Administrador"} detail={item.role || item.status} />)}
    </WorkspaceSection>
    <Modal open={assignment !== null} onClose={() => !saving && (setAssignment(null), setSelected(""))} title={assignment === "resident" ? "Asignar residente" : assignment === "admin" ? "Asignar administrador" : "Asignar personal"} footer={<><Button variant="secondary" disabled={saving} onClick={() => setAssignment(null)}>Cancelar</Button><Button loading={saving} disabled={!selected} onClick={() => void saveAssignment()}>Asignar</Button></>}>
      <Select label="Seleccionar de la organización" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Seleccionar…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</Select>
      <p className="mt-3 text-[var(--text-caption)] text-[var(--color-text-muted)]">La asignación quedará limitada a este establecimiento.</p>
    </Modal>
  </div>;
}

function WorkspaceSection({ title, icon, action, onAdd, children }: { title: string; icon: ReactNode; action: string; onAdd: () => void; children: ReactNode }) {
  return <section className="flex flex-col gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-[var(--color-text-primary)]">{icon}<h2 className="font-display text-[var(--text-h3)]">{title}</h2></div><Button icon={<Plus size={16} />} onClick={onAdd}>{action}</Button></div><div className="flex flex-col gap-2">{children}</div></section>;
}
function WorkspaceRow({ title, detail }: { title: string; detail: string }) { return <Card className="flex items-center justify-between gap-3"><p className="font-medium text-[var(--color-text-primary)]">{title}</p><Badge tone={detail === "active" ? "success" : "neutral"}>{detail}</Badge></Card>; }
