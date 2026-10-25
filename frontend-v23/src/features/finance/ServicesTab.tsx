import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import { getToken } from "@/auth/token";
import { financeApi, type FinanceService, type FinanceUnit } from "@/api/finance";
import { Badge, Button, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { ServiceDetail } from "./ServiceDetail";
import { UNIT_HELP, UNIT_LABEL, UNIT_NAME, financeErrorText, formatDate, formatMargin, rateWithUnit } from "./money";

const SUGGESTED: Array<{ name: string; unit: FinanceUnit; description: string }> = [
  { name: "Cuido en el hogar", unit: "hour", description: "Cuidado en la residencia del cliente." },
  { name: "Cuido hospitalario", unit: "hour", description: "Acompañamiento y cuidado durante una hospitalización." },
  { name: "Acompañamiento a citas médicas", unit: "hour", description: "Traslado y acompañamiento a citas." },
];

export function ServicesTab({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [services, setServices] = useState<FinanceService[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setServices((await financeApi.listServices(organizationId, token)).services); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function addSuggested() {
    const token = getToken(); if (!token) return;
    setAdding(true);
    try {
      for (const s of SUGGESTED) await financeApi.createService(organizationId, s, token);
      toast.show("Servicios añadidos. Ahora configura sus tarifas.", "success");
      await load();
    } catch (e) { toast.show(financeErrorText(e), "danger"); await load(); } finally { setAdding(false); }
  }

  if (failed) return <ErrorState kind="server" onRetry={() => void load()} />;
  if (!services) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;

  const visible = services.filter((s) => showInactive || s.active);
  const inactiveCount = services.filter((s) => !s.active).length;

  return (
    <section className="flex flex-col gap-4" aria-label="Servicios y tarifas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {services.length === 0 ? "Aún no hay servicios." : `${services.filter((s) => s.active).length} servicio(s) activo(s)`}
          {inactiveCount > 0 && (
            <button type="button" className="ml-2 underline" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? "Ocultar desactivados" : `Ver desactivados (${inactiveCount})`}
            </button>
          )}
        </p>
        <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>Añadir servicio</Button>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Crea los servicios que ofrece tu agencia"
          description="Cada servicio tiene su propia tarifa de cobro al cliente y su tarifa de pago al cuidador. Puedes empezar con los sugeridos y ajustar los precios: ETNARA no pone ninguno por defecto."
          action={{ label: adding ? "Añadiendo…" : "Añadir los 3 sugeridos", onClick: () => { if (!adding) void addSuggested(); } }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpenId(s.id)}
                className="group flex h-full w-full flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-card)] transition hover:border-[var(--color-navy-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-navy-700)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-[1.05rem] leading-tight text-[var(--color-text-primary)]">{s.name}</h3>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{UNIT_LABEL[s.unit]}</p>
                  </div>
                  {s.active ? <ChevronRight size={18} className="mt-1 shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-navy-800)]" aria-hidden /> : <Badge>Desactivado</Badge>}
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-50)] p-2.5">
                    <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Cobro al cliente</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-[var(--color-text-primary)]">{rateWithUnit(s.client_cents, s.unit)}</dd>
                  </div>
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-50)] p-2.5">
                    <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Pago al cuidador</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-[var(--color-text-primary)]">{rateWithUnit(s.caregiver_cents, s.unit)}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                  <span>Margen bruto estimado: <strong className="tabular-nums text-[var(--color-sage-700,var(--color-success-700))]">{formatMargin(s.margin)}</strong></span>
                  {s.client_exceptions > 0 && <span>{s.client_exceptions} precio(s) por cliente</span>}
                  {s.caregiver_exceptions > 0 && <span>{s.caregiver_exceptions} excepción(es) de pago</span>}
                  {s.next_change && <span>Cambio programado: {formatDate(s.next_change)}</span>}
                </div>
                {(s.client_cents === null || s.caregiver_cents === null) && s.active && (
                  <p className="text-xs font-medium text-[var(--color-warning-700)]">
                    {s.client_cents === null && s.caregiver_cents === null ? "Falta configurar las tarifas" : s.client_cents === null ? "Falta la tarifa de cobro" : "Falta la tarifa de pago"}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateServiceModal open={creating} organizationId={organizationId} onClose={() => setCreating(false)}
        onCreated={async (id) => { setCreating(false); await load(); setOpenId(id); }} />
      {openId && <ServiceDetail organizationId={organizationId} serviceId={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </section>
  );
}

function CreateServiceModal({ open, organizationId, onClose, onCreated }: { open: boolean; organizationId: string; onClose: () => void; onCreated: (id: string) => void | Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<FinanceUnit>("hour");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(""); setUnit("hour"); setDescription(""); } }, [open]);

  async function save() {
    const token = getToken(); if (!token || name.trim().length < 2) return;
    setSaving(true);
    try {
      const { service } = await financeApi.createService(organizationId, { name: name.trim(), unit, description: description.trim() || null }, token);
      toast.show("Servicio creado. Ahora configura sus tarifas.", "success");
      await onCreated(service.id);
    } catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo servicio" sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={name.trim().length < 2} onClick={() => void save()}>Crear servicio</Button></>}>
      <div className="flex flex-col gap-4">
        <Input label="Nombre" required value={name} maxLength={80} placeholder="Ej.: Cuido nocturno" onChange={(e) => setName(e.target.value)} />
        <Select label="Unidad de cobro y pago" value={unit} onChange={(e) => setUnit(e.target.value as FinanceUnit)} hint={UNIT_HELP[unit]}>
          {(Object.keys(UNIT_NAME) as FinanceUnit[]).map((u) => <option key={u} value={u}>{UNIT_NAME[u]}</option>)}
        </Select>
        <Textarea label="Descripción (opcional)" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        <p className="text-xs text-[var(--color-text-muted)]">La unidad no se puede cambiar después: si cambia la forma de cobrar, crea otro servicio.</p>
      </div>
    </Modal>
  );
}
