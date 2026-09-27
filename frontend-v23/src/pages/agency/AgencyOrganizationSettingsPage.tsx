import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Building2, LogOut, MapPin, Pencil, Plus, RefreshCcw, Settings2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, useToast } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { createEstablishment, listEstablishments, updateEstablishment, type Establishment } from "@/api/establishments";

export function AgencyOrganizationSettingsPage() {
  const { user, logout, activeOrganization, organizations } = useAuth();
  const organizationId = activeOrganization?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const [establishments, setEstablishments] = useState<Establishment[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Establishment | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token) return;
    setError(false);
    try {
      const result = await listEstablishments(organizationId, token);
      setEstablishments(result.establishments);
    } catch {
      setEstablishments([]);
      setError(true);
    }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() { setForm({ name: "", address: "" }); setEditing("new"); }
  function openEdit(establishment: Establishment) { setForm({ name: establishment.name, address: establishment.address ?? "" }); setEditing(establishment); }

  async function saveEstablishment() {
    const token = getToken();
    if (!organizationId || !token || !form.name.trim()) return;
    setSaving(true);
    try {
      const input = { name: form.name.trim(), ...(form.address.trim() ? { address: form.address.trim() } : {}) };
      if (editing === "new") await createEstablishment(organizationId, input, token);
      else if (editing) await updateEstablishment(organizationId, editing.id, { ...input, address: form.address.trim() }, token);
      const wasNew = editing === "new";
      setEditing(null);
      await load();
      toast.show(wasNew ? "Establecimiento creado." : "Establecimiento actualizado.", "success");
    } catch { toast.show("No pudimos guardar el establecimiento.", "danger"); }
    finally { setSaving(false); }
  }

  async function setEstablishmentStatus(establishment: Establishment) {
    const token = getToken();
    if (!organizationId || !token) return;
    setSaving(true);
    try {
      const status = establishment.status === "active" ? "archived" : "active";
      await updateEstablishment(organizationId, establishment.id, { status }, token);
      await load();
      toast.show(status === "archived" ? "Establecimiento archivado." : "Establecimiento reactivado.", "success");
    } catch { toast.show("No pudimos cambiar el estado.", "danger"); }
    finally { setSaving(false); }
  }

  async function onLogout() { await logout(); navigate("/login", { replace: true }); }

  return <div className="flex flex-col gap-[var(--spacing-md)]">
    <PageHeader title="Configuración" description="Administra la organización activa sin mezclar datos de otras agencias." />
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-[var(--color-accent-100)] p-3 text-[var(--color-accent-700)]"><Building2 size={22} /></span>
        <div><p className="text-[var(--text-caption)] uppercase tracking-wide text-[var(--color-text-muted)]">Organización activa</p><p className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">{activeOrganization?.name}</p><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Los residentes, personal, turnos y documentos pertenecen únicamente a esta organización.</p></div>
      </div>
      {organizations.length > 1 && <Button variant="secondary" onClick={() => navigate("/select-organization")}>Cambiar organización</Button>}
    </Card>

    <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-[var(--text-h3)] text-[var(--color-text-primary)]">Establecimientos</h2><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Ubicaciones que pertenecen a {activeOrganization?.name}.</p></div><Button icon={<Plus size={18} />} onClick={openCreate}>Añadir</Button></div>
    {establishments === null ? <Skeleton className="h-28" /> : error ? <ErrorState kind="server" onRetry={() => void load()} /> : establishments.length === 0 ? <EmptyState icon={<Building2 size={28} />} title="No hay establecimientos" description="Añade la primera ubicación de esta organización." action={{ label: "Añadir establecimiento", onClick: openCreate }} /> :
      <div className="flex flex-col gap-3">{establishments.map((establishment) => <Card key={establishment.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className="text-left" onClick={() => establishment.status === "active" && navigate(`/agency/settings/establishments/${establishment.id}`)}>
          <div className="flex items-center gap-2"><p className="font-medium text-[var(--color-text-primary)]">{establishment.name}</p><Badge tone={establishment.status === "active" ? "success" : "neutral"}>{establishment.status === "active" ? "Activo" : "Archivado"}</Badge></div>
          <p className="mt-1 flex items-center gap-1 text-[var(--text-small)] text-[var(--color-text-secondary)]"><MapPin size={15} />{establishment.address || "Dirección no registrada"}</p>
        </button>
        <div className="flex flex-wrap gap-2">
          {establishment.status === "active" && <Button icon={<Settings2 size={16} />} onClick={() => navigate(`/agency/settings/establishments/${establishment.id}`)}>Administrar</Button>}
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => openEdit(establishment)}>Editar</Button>
          <Button variant="ghost" icon={establishment.status === "active" ? <Archive size={16} /> : <RefreshCcw size={16} />} disabled={saving} onClick={() => void setEstablishmentStatus(establishment)}>{establishment.status === "active" ? "Archivar" : "Reactivar"}</Button>
        </div>
      </Card>)}</div>}

    <Modal open={editing !== null} onClose={() => !saving && setEditing(null)} title={editing === "new" ? "Añadir establecimiento" : "Editar establecimiento"} footer={<><Button variant="secondary" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button><Button loading={saving} disabled={!form.name.trim()} onClick={() => void saveEstablishment()}>Guardar</Button></>}>
      <div className="flex flex-col gap-3"><Input label="Nombre" value={form.name} maxLength={120} required onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /><Input label="Dirección (opcional)" value={form.address} maxLength={500} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Este establecimiento quedará asociado exclusivamente a la organización activa.</p></div>
    </Modal>
    <Card className="flex items-center justify-between"><div><p className="font-medium text-[var(--color-text-primary)]">Sesión activa</p>{user?.email && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{user.email}</p>}</div><Button variant="secondary" icon={<LogOut size={18} />} onClick={onLogout}>Cerrar sesión</Button></Card>
  </div>;
}
