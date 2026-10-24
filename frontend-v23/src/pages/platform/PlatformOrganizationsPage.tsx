import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, MailPlus, MoreHorizontal, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { getToken } from "@/auth/token";
import { OrganizationFeaturesCard } from "@/features/platform/OrganizationFeaturesCard";
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
import { Button, Card, EmptyState, ErrorState, IconButton, Input, Modal, Skeleton, useToast } from "@/components/ui";

const STATUS: Record<string, { label: string; className: string }> = {
  active: { label: "Activa", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-800)]" },
  trial: { label: "Prueba", className: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" },
  suspended: { label: "Suspendida", className: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]" },
  archived: { label: "Archivada", className: "bg-[var(--color-ivory-200)] text-[var(--color-text-secondary)]" },
};
function statusOf(status: string) {
  return STATUS[status.toLowerCase()] ?? { label: status, className: "bg-[var(--color-ivory-200)] text-[var(--color-text-secondary)]" };
}
function StatusChip({ status }: { status: string }) {
  const s = statusOf(status);
  return <span data-ui="org-status" className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[length:var(--text-caption)] font-semibold leading-none ${s.className}`}>{s.label}</span>;
}
function initials(name: string) {
  return name.split(/\s+/).filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || name.slice(0, 2).toUpperCase();
}
const LIFECYCLE_LABEL: Record<OrganizationLifecycleAction, string> = { suspend: "Suspender", reactivate: "Reactivar", archive: "Archivar" };
function lifecycleActions(status: string): OrganizationLifecycleAction[] {
  const st = status.toLowerCase();
  if (st === "active" || st === "trial") return ["suspend"];
  if (st === "suspended") return ["reactivate", "archive"];
  return [];
}
const orgTypeLabel = (type: string) => (type === "agency" ? "Agencia de cuidado" : "Hogar / establecimiento residencial");

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

  const [moreOrg, setMoreOrg] = useState<PlatformOrganization | null>(null);

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
    <div className="min-w-0 space-y-4 md:space-y-5">
      <section className="rounded-[var(--radius-xl)] bg-[var(--color-navy-950)] px-5 py-5 text-white md:px-8 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--color-sage-300)]">Clientes B2B</p>
            <h1 className="mt-1.5 font-display text-[length:1.875rem] leading-none md:mt-2 md:text-[length:clamp(2rem,5vw,3.25rem)]">Organizaciones</h1>
            <p className="mt-2 max-w-[42rem] text-[length:var(--text-small)] leading-5 text-white/65 md:mt-3 md:text-sm md:leading-6">Supervisión de tenants, estructura y métricas agregadas. ETNARA no muestra expedientes privados de empleados ni residentes.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} aria-label="Actualizar"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/25 bg-white/5 text-[length:1rem] font-medium text-white transition-colors hover:bg-white/10 md:w-auto md:px-4">
              <RefreshCw size={17} /><span className="hidden md:inline">Actualizar</span>
            </button>
            <Button className="flex-1 whitespace-nowrap md:flex-none" icon={<Plus size={17}/>} onClick={() => setCreating(true)} aria-label="Nueva organización"><span className="min-[360px]:hidden">Nueva</span><span className="hidden min-[360px]:inline">Nueva organización</span></Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] md:p-[var(--spacing-md)]"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] md:text-xs">Total</p><p className="mt-1 font-display text-2xl leading-none md:mt-2 md:text-3xl">{organizations?.length ?? "—"}</p></div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] md:p-[var(--spacing-md)]"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] md:text-xs">Activas</p><p className="mt-1 font-display text-2xl leading-none md:mt-2 md:text-3xl">{organizations?.filter((o) => o.status.toLowerCase() === "active").length ?? "—"}</p></div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-card)] md:p-[var(--spacing-md)]"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] md:text-xs">Privacidad</p><p className="mt-1 flex items-center gap-1 text-[length:var(--text-small)] font-semibold leading-tight text-[var(--color-navy-950)] md:mt-2 md:text-sm"><ShieldCheck size={15} className="shrink-0 text-[var(--color-sage-700)] md:hidden"/><span className="md:hidden">Aislados</span><span className="hidden md:inline">Datos privados aislados</span></p></div>
      </div>

      <div className="md:rounded-[var(--radius-lg)] md:border md:border-[var(--color-border)] md:bg-[var(--color-surface)] md:p-[var(--spacing-md)] md:shadow-[var(--shadow-card)]">
        <label className="relative block">
          <span className="sr-only">Buscar organización</span>
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"/>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar organización" className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-10 pr-3 text-[length:1rem] outline-none md:text-sm"/>
        </label>
      </div>

      {organizations === null && !error ? <Skeleton className="h-48"/> : error ? <Card><ErrorState kind="server" onRetry={() => void load()}/></Card> : filtered.length === 0 ? <Card><EmptyState icon={<Building2 size={30}/>} title="No hay organizaciones"/></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((org) => {
            const actions = lifecycleActions(org.status);
            return (
              <article key={org.id} data-ui="org-card" className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] md:min-h-[220px] md:p-5">
                {/* Phones: identity in one compact row */}
                <div className="flex items-start gap-3 md:hidden">
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sage-100)] text-[length:var(--text-small)] font-semibold tracking-wide text-[var(--color-sage-800)]">{initials(org.name)}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 font-sans text-[length:1rem] font-semibold leading-snug text-[var(--color-text-primary)]">{org.name}</h2>
                    <p className="mt-0.5 truncate text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{orgTypeLabel(org.type)}</p>
                  </div>
                  <StatusChip status={org.status}/>
                </div>
                {/* Tablet / desktop: unchanged layout */}
                <div className="hidden md:block">
                  <div className="mb-4 flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-100)]"><Building2 size={19}/></div><StatusChip status={org.status}/></div>
                  <h2 className="font-display text-[var(--text-h3)]">{org.name}</h2>
                  <p className="mt-1 text-[var(--text-small)] text-[var(--color-text-secondary)]">{orgTypeLabel(org.type)}</p>
                </div>

                <div className="mt-4 flex gap-2 md:hidden">
                  <Button className="flex-1" onClick={() => void inspect(org)}>Ver resumen</Button>
                  <Button variant="secondary" icon={<MailPlus size={16}/>} onClick={() => openInvite(org)} aria-label={`Invitar administrador a ${org.name}`}>Invitar</Button>
                  {actions.length > 0 && <IconButton variant="secondary" icon={<MoreHorizontal size={18}/>} label={`Más acciones para ${org.name}`} onClick={() => setMoreOrg(org)} />}
                </div>
                <div className="mt-5 hidden gap-2 md:grid md:grid-cols-2">
                  <Button onClick={() => void inspect(org)}>Ver resumen</Button>
                  <Button variant="secondary" icon={<MailPlus size={16}/>} onClick={() => openInvite(org)}>Invitar admin</Button>
                  {actions.map((action) => <Button key={action} variant="secondary" onClick={() => openLifecycle(org, action)}>{LIFECYCLE_LABEL[action]}</Button>)}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal sheetOnMobile open={moreOrg !== null} onClose={() => setMoreOrg(null)} eyebrow="Acciones" title={moreOrg?.name ?? "Organización"}>
        {moreOrg && (
          <div className="space-y-2">
            {lifecycleActions(moreOrg.status).map((action) => (
              <button key={action} type="button" onClick={() => { const org = moreOrg; setMoreOrg(null); openLifecycle(org, action); }}
                className={`flex min-h-12 w-full items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white px-4 text-left text-[length:1rem] font-medium ${action === "archive" || action === "suspend" ? "text-[var(--color-danger-700)]" : "text-[var(--color-text-primary)]"}`}>
                {LIFECYCLE_LABEL[action]} organización <ChevronRight size={18} className="text-[var(--color-text-muted)]"/>
              </button>
            ))}
            <p className="pt-1 text-[length:var(--text-small)] text-[var(--color-text-secondary)]">Se pedirá un motivo; el cambio queda registrado.</p>
          </div>
        )}
      </Modal>

      <Modal sheetOnMobile wide open={selectedOrg !== null} onClose={() => setSelectedOrg(null)} eyebrow="Resumen de la organización" title={selectedOrg?.name ?? "Organización"} footer={<Button onClick={() => setSelectedOrg(null)}>Cerrar</Button>}>
        {loadingOverview ? <Skeleton className="h-40"/> : overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: overview.counts.active_workers, label: "Personal activo" },
                { value: overview.locations.length, label: "Estableci\u00ADmientos" },
                { value: overview.counts.residents, label: "Residentes" },
              ].map((m) => (
                <div key={m.label} className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-ivory-50)] px-3 py-3">
                  <strong className="block font-display text-2xl leading-none">{m.value}</strong>
                  <span className="mt-1.5 block text-[length:var(--text-caption)] font-medium leading-tight text-[var(--color-text-secondary)] [hyphens:manual] [overflow-wrap:anywhere]">{m.label}</span>
                </div>
              ))}
            </div>
            {selectedOrg && <OrganizationFeaturesCard organizationId={selectedOrg.id}/>}
            {credentialSummary && (
              <section className="rounded-[1.25rem] border border-[var(--color-border)] bg-white p-4">
                <h3 className="font-sans text-[length:0.9375rem] font-semibold">Credenciales <span className="font-normal text-[var(--color-text-secondary)]">· resumen agregado</span></h3>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--text-small)]">
                  {[["Total", credentialSummary.credentials_total], ["Pendientes", credentialSummary.credentials_pending], ["Aprobadas", credentialSummary.credentials_verified], ["Rechazadas", credentialSummary.credentials_rejected]].map(([k, v]) => (
                    <div key={String(k)} className="flex items-baseline justify-between gap-2 border-b border-[var(--color-border)] pb-1.5"><dt className="text-[var(--color-text-secondary)]">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                  ))}
                </dl>
              </section>
            )}
            <section className="rounded-[1.25rem] border border-[var(--color-border)] bg-white p-4">
              <h3 className="mb-1 font-sans text-[length:0.9375rem] font-semibold">Establecimientos</h3>
              {overview.locations.length ? overview.locations.map((location) => (
                <button key={location.id} type="button" onClick={() => void inspectEstablishment(location.id)} className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-[var(--color-border)] py-2 text-left text-[length:var(--text-small)] last:border-b-0">
                  <span className="min-w-0 truncate">{location.name}</span><ChevronRight size={16} className="shrink-0 text-[var(--color-text-muted)]"/>
                </button>
              )) : <p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]">No hay establecimientos registrados.</p>}
            </section>
            <p className="flex items-start gap-2 text-[length:var(--text-caption)] leading-4 text-[var(--color-text-muted)]"><ShieldCheck size={14} className="mt-px shrink-0"/>ETNARA solo recibe conteos y datos institucionales necesarios para operar la cuenta.</p>
          </div>
        ) : null}
      </Modal>

      <Modal sheetOnMobile open={establishment !== null} onClose={() => setEstablishment(null)} eyebrow="Establecimiento" title={establishment?.name ?? "Resumen del establecimiento"} footer={<Button onClick={() => setEstablishment(null)}>Cerrar</Button>}>
        {establishment && <div className="space-y-3"><div className="grid grid-cols-3 gap-2">{[["Unidades", establishment.units_count], ["Habitaciones", establishment.rooms_count], ["Residentes", establishment.residents_count]].map(([k, v]) => <div key={String(k)} className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-ivory-50)] px-3 py-3"><strong className="block font-display text-2xl leading-none">{v}</strong><span className="mt-1.5 block text-[length:var(--text-caption)] font-medium leading-tight text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{k}</span></div>)}</div><p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">Sin acceso a expedientes de residentes.</p></div>}
      </Modal>

      <Modal sheetOnMobile open={creating} onClose={() => !saving && setCreating(false)} title="Nueva organización" footer={<><Button variant="secondary" disabled={saving} onClick={() => setCreating(false)}>Cancelar</Button><Button loading={saving} onClick={() => void createOrganization()}>Crear organización</Button></>}>
        <div className="space-y-4"><Input label="Nombre de la organización" value={name} onChange={(e) => setName(e.target.value)}/><label className="block text-[length:var(--text-small)] font-medium text-[var(--color-text-primary)]">Tipo<select className="mt-1.5 min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-[length:1rem]" value={type} onChange={(e) => setType(e.target.value as PlatformOrganizationType)}><option value="agency">Agencia de cuidado</option><option value="residential_establishment">Hogar / establecimiento residencial</option></select></label></div>
      </Modal>

      <Modal sheetOnMobile open={inviteOrg !== null} onClose={() => !inviting && setInviteOrg(null)} eyebrow="Invitar administrador" title={inviteOrg?.name ?? "Invitar administrador"} footer={emailDelivery ? <Button onClick={() => setInviteOrg(null)}>Cerrar</Button> : <><Button variant="secondary" disabled={inviting} onClick={() => setInviteOrg(null)}>Cancelar</Button><Button loading={inviting} onClick={() => void invite()}>Enviar invitación</Button></>}>
        <div className="space-y-4">{emailDelivery?.status === "sent" ? <p><strong>Invitación enviada a {email}.</strong></p> : emailDelivery?.status === "failed" ? <><p>La invitación fue creada, pero el correo no pudo enviarse.</p><div className="break-all rounded border p-3 font-mono text-sm">{activationToken}</div></> : <Input label="Correo del administrador" type="email" value={email} onChange={(e) => setEmail(e.target.value)}/>}</div>
      </Modal>

      <Modal sheetOnMobile open={lifecycleOrg !== null} onClose={() => !lifecycleSaving && setLifecycleOrg(null)} eyebrow={LIFECYCLE_LABEL[lifecycleAction]} title={lifecycleOrg?.name ?? "Actualizar estado"} footer={<><Button variant="secondary" disabled={lifecycleSaving} onClick={() => setLifecycleOrg(null)}>Cancelar</Button><Button loading={lifecycleSaving} disabled={lifecycleReason.trim().length < 5} onClick={() => void saveLifecycle()}>Confirmar</Button></>}>
        <div className="space-y-3">
          <p className="text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]">Escribe el motivo (mínimo 5 caracteres). El cambio de estado queda registrado.</p>
          <Input label="Motivo" value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
