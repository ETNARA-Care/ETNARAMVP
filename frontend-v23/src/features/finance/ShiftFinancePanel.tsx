import { useCallback, useEffect, useState } from "react";
import { Landmark, Lock, Pencil } from "lucide-react";
import { getToken } from "@/auth/token";
import { financeApi, type BillingClient, type FinanceService, type ShiftFinance } from "@/api/finance";
import { Badge, Button, Card, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { financeErrorText, formatCents, formatDate, formatMargin, hoursFromHundredths, rateWithUnit, UNIT_LABEL } from "./money";

const EXCEPTION_TEXT: Record<string, string> = {
  NO_SERVICE: "Sin servicio asignado",
  NO_CLIENT: "Sin pagador",
  NO_BILLING_RATE: "El servicio no tiene tarifa de cobro para esa fecha",
  NO_PAY_RATE: "El servicio no tiene tarifa de pago para esa fecha",
  PARTIAL_DAY: "Día incompleto: la agencia decide cómo cobrarlo y pagarlo",
};

/**
 * Finanzas del turno (backend 119): service, payer and authorised units, with
 * the billing and pay rates that apply on the service date. Agency
 * administrator only, FINANZAS on only. The shift itself is never modified.
 */
export function ShiftFinancePanel({ organizationId, shiftId }: { organizationId: string; shiftId: string }) {
  const [data, setData] = useState<ShiftFinance | null>(null);
  const [services, setServices] = useState<FinanceService[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try {
      const [f, s, c] = await Promise.all([
        financeApi.getShift(organizationId, shiftId, token),
        financeApi.listServices(organizationId, token),
        financeApi.listClients(organizationId, token),
      ]);
      setData(f); setServices(s.services); setClients(c.clients); setFailed(false);
    } catch { setFailed(true); }
  }, [organizationId, shiftId]);
  useEffect(() => { void load(); }, [load]);

  if (failed) return null;
  if (!data) return <Skeleton className="h-32" />;

  const r = data.resolution;
  const unit = r?.service.unit ?? "hour";
  const service = services.find((s) => s.id === data.effective.serviceId);
  const client = clients.find((c) => c.id === data.effective.billingClientId);

  return (
    <Card className="flex flex-col gap-3" data-shift-finance>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg"><Landmark size={18} aria-hidden />Finanzas del turno</h2>
          <p className="text-xs text-[var(--color-text-muted)]">Solo administradores · fecha del servicio {formatDate(data.serviceDate)}</p>
        </div>
        {data.locked
          ? <Badge tone="neutral"><Lock size={12} className="mr-1 inline" aria-hidden />Horas aprobadas</Badge>
          : <Button size="sm" variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Editar</Button>}
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-[var(--color-text-muted)]">Servicio</dt>
          <dd className="font-medium">{service?.name ?? "Sin servicio"}{service && <span className="text-xs text-[var(--color-text-muted)]"> · {UNIT_LABEL[service.unit]}{data.effective.serviceSource === "recipient_default" ? " · del residente" : ""}</span>}</dd></div>
        <div><dt className="text-xs text-[var(--color-text-muted)]">Pagador</dt>
          <dd className="font-medium">{client?.full_name ?? "Sin pagador"}{client && data.effective.clientSource === "recipient_primary" ? <span className="text-xs text-[var(--color-text-muted)]"> · principal del residente</span> : null}</dd></div>
        <div><dt className="text-xs text-[var(--color-text-muted)]">Cuidador/a</dt>
          <dd className="font-medium">{data.effective.caregiverName ?? "Sin asignar"}</dd></div>
      </dl>

      {r && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Tarifa de pago" value={rateWithUnit(r.pay?.amountCents ?? null, unit)} hint={r.pay ? (r.pay.source === "caregiver" ? "excepción del cuidador" : "general") : undefined} />
          <Metric label="Tarifa de cobro" value={rateWithUnit(r.billing?.amountCents ?? null, unit)} hint={r.billing ? (r.billing.source === "client" ? "precio del cliente" : "general") : undefined} />
          <Metric label="Diferencia por unidad" value={formatMargin(r.unitMargin)} />
          <Metric label={data.effective.minutesSource === "approved_timesheet" ? "Estimado (horas aprobadas)" : "Estimado (horario)"}
            value={r.estimate?.margin ? formatCents(r.estimate.margin.differenceCents) : "—"}
            hint={r.estimate?.billing && r.estimate.pay ? `${formatCents(r.estimate.billing.amountCents)} cobro · ${formatCents(r.estimate.pay.amountCents)} pago` : undefined} />
        </div>
      )}
      {data.terms.authorizedUnitsHundredths != null && (
        <p className="text-sm">Autorizado: <strong>{hoursFromHundredths(data.terms.authorizedUnitsHundredths)}</strong> {unit === "hour" ? "h" : unit === "day" ? "día(s)" : "unidad(es)"}</p>
      )}
      {data.exceptions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">{data.exceptions.map((e) => <li key={e}><Badge tone="warning">{EXCEPTION_TEXT[e] ?? e}</Badge></li>)}</ul>
      )}
      <p className="text-xs text-[var(--color-text-muted)]">Margen bruto estimado: no incluye nómina, contribuciones ni otros gastos.</p>

      {editing && <EditShiftFinance organizationId={organizationId} shiftId={shiftId} data={data} services={services.filter((s) => s.active)} clients={clients.filter((c) => c.active)}
        onClose={() => setEditing(false)} onSaved={(next) => { setData(next); setEditing(false); }} />}
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-50)] p-2.5">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[0.7rem] text-[var(--color-text-secondary)]">{hint}</p>}
    </div>
  );
}

function EditShiftFinance({ organizationId, shiftId, data, services, clients, onClose, onSaved }: {
  organizationId: string; shiftId: string; data: ShiftFinance; services: FinanceService[]; clients: BillingClient[];
  onClose: () => void; onSaved: (next: ShiftFinance) => void;
}) {
  const toast = useToast();
  const [serviceId, setServiceId] = useState(data.terms.serviceId ?? "");
  const [clientId, setClientId] = useState(data.terms.billingClientId ?? "");
  const [authorized, setAuthorized] = useState(data.terms.authorizedUnitsHundredths != null ? String(data.terms.authorizedUnitsHundredths / 100) : "");
  const [note, setNote] = useState(data.terms.note ?? "");
  const [saving, setSaving] = useState(false);
  const match = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(authorized.trim());
  const hundredths = authorized.trim() === "" ? null : match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : NaN;

  async function save() {
    const token = getToken(); if (!token || Number.isNaN(hundredths)) return;
    setSaving(true);
    try {
      const next = await financeApi.setShift(organizationId, shiftId, { serviceId: serviceId || null, billingClientId: clientId || null, authorizedUnitsHundredths: hundredths || null, note: note.trim() || null }, token);
      toast.show("Finanzas del turno guardadas.", "success");
      onSaved(next);
    } catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }
  const unit = services.find((s) => s.id === serviceId)?.unit;
  return (
    <Modal open onClose={onClose} title="Finanzas del turno" sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={Number.isNaN(hundredths)} onClick={() => void save()}>Guardar</Button></>}>
      <div className="flex flex-col gap-4">
        <Select label="Servicio" value={serviceId} onChange={(e) => setServiceId(e.target.value)} hint="Vacío: se usa el servicio por defecto del residente, si tiene.">
          <option value="">Sin servicio en este turno</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {UNIT_LABEL[s.unit]}</option>)}
        </Select>
        <Select label="Pagador" value={clientId} onChange={(e) => setClientId(e.target.value)} hint="Vacío: se usa el pagador principal del residente.">
          <option value="">Pagador principal del residente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </Select>
        <Input label={`Unidades autorizadas${unit ? ` (${unit === "hour" ? "horas" : unit === "day" ? "días" : "unidades"})` : ""}`} inputMode="decimal" placeholder="Opcional"
          value={authorized} onChange={(e) => setAuthorized(e.target.value)} error={Number.isNaN(hundredths) ? "Escribe un número como 8 o 7.5" : undefined} />
        <Textarea label="Nota interna (opcional)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
