import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, MailPlus, Plus, RefreshCw, Search } from "lucide-react";
import { getToken } from "@/auth/token";
import {
  createPlatformOrganization,
  getPlatformOrganizationCredentialSummary,
  getPlatformOrganizationEstablishment,
  getPlatformOrganizationOverview,
  inviteOrganizationAdmin,
  listPlatformOrganizations,
  updatePlatformOrganizationLifecycle,
  type EmailDelivery,
  type OrganizationLifecycleAction,
  type PlatformEstablishment,
  type PlatformOrganization,
  type PlatformOrganizationCredentialSummary,
  type PlatformOrganizationOverview,
  type PlatformOrganizationType,
} from "@/api/platformOrganizations";
import { Button, Card, EmptyState, ErrorState, Input, Modal, Skeleton, useToast } from "@/components/ui";

export function PlatformOrganizationsPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<PlatformOrganizationType>("agency");
  const [saving, setSaving] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState<PlatformOrganization | null>(null);
  const [overview, setOverview] = useState<PlatformOrganizationOverview | null>(null);
  const [credentialSummary, setCredentialSummary] = useState<PlatformOrganizationCredentialSummary | null>(null);
  const [establishment, setEstablishment] = useState<PlatformEstablishment | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [inviteOrg, setInviteOrg] = useState<PlatformOrganization | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [emailDelivery, setEmailDelivery] = useState<EmailDelivery | null>(null);

  const [lifecycleOrg, setLifecycleOrg] = useState<PlatformOrganization | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<OrganizationLifecycleAction>("suspend");
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleSaving, setLifecycleSaving] = useState(false);

  const toast = useToast();

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setError(false);
    try {
      setOrganizations(await listPlatformOrganizations(token));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function inspect(org: PlatformOrganization) {
    const token = getToken();
    if (!token) return;
    setSelectedOrg(org);
    setOverview(null);
    setCredentialSummary(null);
    setEstablishment(null);
    setLoadingOverview(true);
    try {
      const [organizationOverview, credentials] = await Promise.all([
        getPlatformOrganizationOverview(org.id, token),
        getPlatformOrganizationCredentialSummary(org.id, token),
      ]);
      setOverview(organizationOverview);
      setCredentialSummary(credentials);
    } catch {
      toast.show("No pudimos cargar el resumen operacional.", "danger");
      setSelectedOrg(null);
    } finally {
      setLoadingOverview(false);
    }
  }

  async function inspectEstablishment(locationId: string) {
    const token = getToken();
    if (!token || !selectedOrg) return;
    try {
      setEstablishment(await getPlatformOrganizationEstablishment(selectedOrg.id, locationId, token));
    } catch {
      toast.show("No pudimos cargar el establecimiento.", "danger");
    }
  }

  async function createOrganization() {
    const token = getToken();
    if (!token || !name.trim()) return;
    setSaving(true);
    try {
      await createPlatformOrganization({ name: name.trim(), type }, token);
      setCreating(false);
      setName("");
      await load();
      toast.show("Organización creada.", "success");
    } catch {
      toast.show("No pudimos crear la organización.", "danger");
    } finally {
      setSaving(false);
    }
  }

  function openInvite(org: PlatformOrganization) {
    setInviteOrg(org);
    setEmail("");
    setActivationToken(null);
    setEmailDelivery(null);
  }

  async function invite() {
    const token = getToken();
    if (!token || !inviteOrg || !email.trim()) return;
    setInviting(true);
    try {
      const result = await inviteOrganizationAdmin(inviteOrg.id, email.trim(), token);
      setActivationToken(result.activationToken);
      setEmailDelivery(result.emailDelivery);
      toast.show(result.emailDelivery.status === "sent" ? "Invitación enviada." : "Invitación creada; el correo no pudo enviarse.", result.emailDelivery.status === "sent" ? "success" : "warning");
    } catch {
      toast.show("No pudimos crear la invitación.", "danger");
    } finally {
      setInviting(false);
    }
  }

  function openLifecycle(org: PlatformOrganization, action: OrganizationLifecycleAction) {
    setLifecycleOrg(org);
    setLifecycleAction(action);
    setLifecycleReason("");
  }

  async function saveLifecycle() {
    const token = getToken();
    if (!token || !lifecycleOrg || lifecycleReason.trim().length < 5) return;
    setLifecycleSaving(true);
    try {
      await updatePlatformOrganizationLifecycle(lifecycleOrg.id, lifecycleAction, lifecycleReason.trim(), token);
      setLifecycleOrg(null);
      await load();
      toast.show("Estado actualizado.", "success");
    } catch {
      toast.show("No pudimos actualizar el estado.", "danger");
    } finally {
      setLifecycleSaving(false);
    }
  }

  const loaded = organizations ?? [];
  const filtered = useMemo(
    () => loaded.filter((org) => org.name.toLowerCase().includes(query.trim().toLowerCase())),
    [loaded, query],
  );

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-[var(--radius-xl)] bg-[var(--color-navy-950)] px-5 py-6 text-white md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--color-sage-300)]">Clientes B2B</p>
            <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.25rem)] leading-none">Organizaciones</h1>
            <p className="mt-3 max-w-[42rem] text-sm leading-6 text-white/65">Supervisión de tenants, estructura y métricas agregadas. ETNARA no muestra expedientes privados de empleados ni residentes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<RefreshCw size={17}/>} onClick={() => void load()}>Actualizar</Button>
            <Button icon={<Plus size={17}/>} onClick={() => setCreating(true)}>Nueva organización</Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Total</p><p className="mt-2 font-display text-3xl">{organizations?.length ?? "—"}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Activas</p><p className="mt-2 font-display text-3xl">{organizations?.filter((o) => o.status.toLowerCase() === "active").length ?? "—"}</p></Card>
        <Card className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Privacidad</p><p className="mt-2 text-sm font-semibold text-[var(--color-navy-950)]">Datos privados aislados</p></Card>
      </div>

      <Card className="p-4">
        <label className="relative block">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"/>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar organización" className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-10 pr-3 text-sm outline-none"/>
        </label>
      </Card>

      {organizations === null && !error ? <Skeleton className="h-48"/> : error ? <Card><ErrorState kind="server" onRetry={() => void load()}/></Card> : filtered.length === 0 ? <Card><EmptyState icon={<Building2 size={30}/>} title="No hay organizaciones"/></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((org) => (
            <Card key={org.id} className="flex min-h-[220px] flex-col justify-between p-5">
              <div>
                <div className="mb-4 flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-100)]"><Building2 size={19}/></div><span className="rounded-full bg-[var(--color-sage-100)] px-2.5 py-1 text-xs font-semibold">{org.status}</span></div>
                <h2 className="font-display text-[var(--text-h3)]">{org.name}</h2>
                <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">{org.type === "agency" ? "Agencia de cuidado" : "Hogar / establecimiento residencial"}</p>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Button onClick={() => void inspect(org)}>Ver resumen</Button>
                <Button variant="secondary" icon={<MailPlus size={16}/>} onClick={() => openInvite(org)}>Invitar admin</Button>
                {["active", "trial"].includes(org.status.toLowerCase()) ? <Button variant="secondary" onClick={() => openLifecycle(org, "suspend")}>Suspender</Button> : org.status.toLowerCase() === "suspended" ? <><Button variant="secondary" onClick={() => openLifecycle(org, "reactivate")}>Reactivar</Button><Button variant="secondary" onClick={() => openLifecycle(org, "archive")}>Archivar</Button></> : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={selectedOrg !== null} onClose={() => setSelectedOrg(null)} title={selectedOrg ? `ETNARA → ${selectedOrg.name}` : "Organización"} footer={<Button onClick={() => setSelectedOrg(null)}>Cerrar</Button>}>
        {loadingOverview ? <Skeleton className="h-40"/> : overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Card className="p-3"><strong className="font-display text-2xl">{overview.counts.active_workers}</strong><div className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">Personal activo</div></Card>
              <Card className="p-3"><strong className="font-display text-2xl">{overview.locations.length}</strong><div className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">Establecimientos</div></Card>
              <Card className="p-3"><strong className="font-display text-2xl">{overview.counts.residents}</strong><div className="text-[var(--text-caption)] text-[var(--color-text-secondary)]">Residentes</div></Card>
            </div>
            {credentialSummary && <Card><h3 className="font-semibold">Credenciales · resumen agregado</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div>Total: {credentialSummary.credentials_total}</div><div>Pendientes: {credentialSummary.credentials_pending}</div><div>Aprobadas: {credentialSummary.credentials_verified}</div><div>Rechazadas: {credentialSummary.credentials_rejected}</div></div></Card>}
            <Card><h3 className="mb-2 font-semibold">Establecimientos</h3>{overview.locations.length ? overview.locations.map((location) => <button key={location.id} type="button" onClick={() => void inspectEstablishment(location.id)} className="block w-full border-b py-3 text-left">{location.name}</button>) : <p className="text-sm text-[var(--color-text-secondary)]">No hay establecimientos registrados.</p>}</Card>
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">ETNARA solo recibe conteos y datos institucionales necesarios para operar la cuenta.</p>
          </div>
        ) : null}
      </Modal>

      <Modal open={establishment !== null} onClose={() => setEstablishment(null)} title="Resumen del establecimiento" footer={<Button onClick={() => setEstablishment(null)}>Cerrar</Button>}>
        {establishment && <div className="space-y-3"><h2 className="font-display text-[var(--text-h3)]">{establishment.name}</h2><Card><div className="space-y-2 text-sm"><div><strong>Unidades:</strong> {establishment.units_count}</div><div><strong>Habitaciones:</strong> {establishment.rooms_count}</div><div><strong>Residentes:</strong> {establishment.residents_count}</div></div></Card><p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Sin acceso a expedientes de residentes.</p></div>}
      </Modal>

      <Modal open={creating} onClose={() => !saving && setCreating(false)} title="Nueva organización" footer={<><Button variant="secondary" disabled={saving} onClick={() => setCreating(false)}>Cancelar</Button><Button loading={saving} onClick={() => void createOrganization()}>Crear organización</Button></>}>
        <div className="space-y-4"><Input label="Nombre de la organización" value={name} onChange={(e) => setName(e.target.value)}/><label className="block">Tipo<select className="mt-1 w-full rounded border p-3" value={type} onChange={(e) => setType(e.target.value as PlatformOrganizationType)}><option value="agency">Agencia de cuidado</option><option value="residential_establishment">Hogar / establecimiento residencial</option></select></label></div>
      </Modal>

      <Modal open={inviteOrg !== null} onClose={() => !inviting && setInviteOrg(null)} title={inviteOrg ? `Invitar administrador — ${inviteOrg.name}` : "Invitar administrador"} footer={emailDelivery ? <Button onClick={() => setInviteOrg(null)}>Cerrar</Button> : <><Button variant="secondary" disabled={inviting} onClick={() => setInviteOrg(null)}>Cancelar</Button><Button loading={inviting} onClick={() => void invite()}>Enviar invitación</Button></>}>
        <div className="space-y-4">{emailDelivery?.status === "sent" ? <p><strong>Invitación enviada a {email}.</strong></p> : emailDelivery?.status === "failed" ? <><p>La invitación fue creada, pero el correo no pudo enviarse.</p><div className="break-all rounded border p-3 font-mono text-sm">{activationToken}</div></> : <Input label="Correo del administrador" type="email" value={email} onChange={(e) => setEmail(e.target.value)}/>}</div>
      </Modal>

      <Modal open={lifecycleOrg !== null} onClose={() => !lifecycleSaving && setLifecycleOrg(null)} title="Actualizar estado" footer={<><Button variant="secondary" disabled={lifecycleSaving} onClick={() => setLifecycleOrg(null)}>Cancelar</Button><Button loading={lifecycleSaving} disabled={lifecycleReason.trim().length < 5} onClick={() => void saveLifecycle()}>Confirmar</Button></>}>
        <Input label="Motivo" value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)} />
      </Modal>
    </div>
  );
}
