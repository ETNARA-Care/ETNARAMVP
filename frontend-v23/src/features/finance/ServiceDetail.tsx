import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Calculator, History, Plus, Power } from "lucide-react";
import { getToken } from "@/auth/token";
import {
  financeApi, type BillingClient, type CaregiverRates, type DayType, type FinanceRate, type HalfDayPolicy, type NewRate,
  type RateKind, type RateScope, type Resolution, type ServiceRates,
} from "@/api/finance";
import { Badge, Button, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import {
  HALF_DAY_LABEL, UNIT_HELP, UNIT_LABEL, financeErrorText, formatCents, formatDate, formatMargin, hoursFromHundredths, parseDollars, rateWithUnit,
} from "./money";

interface Props { organizationId: string; serviceId: string; onClose: () => void; onChanged: () => void }
type FormPreset = { kind: RateKind; scope: RateScope; dayType: DayType; targetId?: string | null };

const ACTION_LABEL: Record<string, string> = {
  FINANCE_SERVICE_CREATED: "Servicio creado", FINANCE_SERVICE_UPDATED: "Servicio editado",
  FINANCE_SERVICE_DEACTIVATED: "Servicio desactivado", FINANCE_SERVICE_ACTIVATED: "Servicio activado",
  FINANCE_RATE_CREATED: "Nueva tarifa", FINANCE_RATE_ENDED: "Tarifa terminada",
};

export function ServiceDetail({ organizationId, serviceId, onClose, onChanged }: Props) {
  const toast = useToast();
  const { show } = toast; // stable (useCallback in ToastProvider)
  const [data, setData] = useState<ServiceRates | null>(null);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [caregivers, setCaregivers] = useState<CaregiverRates[]>([]);
  const [form, setForm] = useState<FormPreset | null>(null);
  const [ending, setEnding] = useState<FinanceRate | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try {
      const [rates, c, g] = await Promise.all([
        financeApi.listRates(organizationId, serviceId, token),
        financeApi.listClients(organizationId, token),
        financeApi.listCaregivers(organizationId, token),
      ]);
      setData(rates); setClients(c.clients.filter((x) => x.active)); setCaregivers(g.caregivers.filter((x) => x.membership_status === "active"));
    } catch (e) { show(financeErrorText(e, "No se pudo cargar el servicio."), "danger"); }
  }, [organizationId, serviceId, show]);
  useEffect(() => { void load(); }, [load]);

  async function toggleActive() {
    const token = getToken(); if (!token || !data) return;
    const next = !data.service.active;
    if (!next && !window.confirm("¿Desactivar este servicio? No se podrá asignar a turnos nuevos ni recibir tarifas nuevas. Su historial se conserva.")) return;
    setTogglingActive(true);
    try { await financeApi.updateService(organizationId, serviceId, { active: next }, token); toast.show(next ? "Servicio activado." : "Servicio desactivado.", "success"); await load(); onChanged(); }
    catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setTogglingActive(false); }
  }

  const rates = data?.rates ?? [];
  const live = (r: FinanceRate) => r.status !== "past";
  const unit = data?.service.unit ?? "hour";

  return (
    <Modal open onClose={onClose} title={data?.service.name ?? "Servicio"} eyebrow={data ? `Servicio ${UNIT_LABEL[unit]}` : undefined} fullScreenOnMobile wide
      footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
      {!data ? <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div> : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">{UNIT_HELP[unit]}</p>
            <Button size="sm" variant="secondary" icon={<Power size={16} />} loading={togglingActive} onClick={() => void toggleActive()}>
              {data.service.active ? "Desactivar" : "Activar"}
            </Button>
          </div>

          <RateSection
            title="Cobro al cliente" subtitle="Lo que la agencia factura. Un precio negociado con un cliente tiene prioridad sobre el general."
            unit={unit} rates={rates.filter((r) => r.rate_kind === "client" && live(r))} disabled={!data.service.active}
            actions={[
              { label: "Cambiar tarifa general", preset: { kind: "client", scope: "general", dayType: "standard" } },
              { label: "Precio especial por cliente", preset: { kind: "client", scope: "client", dayType: "standard" } },
              { label: "Tarifa de feriado", preset: { kind: "client", scope: "general", dayType: "holiday" } },
            ]}
            onAdd={setForm} onEnd={setEnding}
          />
          <RateSection
            title="Pago al cuidador" subtitle="Lo que se usa para calcular la compensación. Una excepción para un cuidador tiene prioridad sobre la general."
            unit={unit} rates={rates.filter((r) => r.rate_kind === "caregiver" && live(r))} disabled={!data.service.active}
            actions={[
              { label: "Cambiar tarifa general", preset: { kind: "caregiver", scope: "general", dayType: "standard" } },
              { label: "Excepción por cuidador", preset: { kind: "caregiver", scope: "caregiver", dayType: "standard" } },
              { label: "Tarifa de feriado", preset: { kind: "caregiver", scope: "general", dayType: "holiday" } },
            ]}
            onAdd={setForm} onEnd={setEnding}
          />

          <Simulator organizationId={organizationId} serviceId={serviceId} unit={unit} clients={clients} caregivers={caregivers} today={data.today} />

          <section aria-label="Historial de precios" className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-display text-[1.05rem]"><History size={18} aria-hidden />Historial de precios</h3>
            {rates.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">Aún no hay tarifas.</p> : (
              <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
                {[...rates].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{r.rate_kind === "client" ? "Cobro" : "Pago"} · {targetLabel(r)}{r.day_type === "holiday" ? " · feriado" : ""}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(r.effective_from)} → {formatDate(r.effective_to)}{r.reason ? ` · ${r.reason}` : ""}{r.end_reason ? ` · Fin: ${r.end_reason}` : ""}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{r.created_by_email ?? ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{rateWithUnit(r.amount_cents, unit)}</span>
                      <StatusPill status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.history.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-[var(--color-text-secondary)]">Registro de cambios ({data.history.length})</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {data.history.map((h, i) => (
                    <li key={i} className="text-xs text-[var(--color-text-secondary)]">
                      {new Date(h.occurred_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })} · {ACTION_LABEL[h.action] ?? h.action} · {h.actor_email ?? ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      )}
      {form && data && (
        <RateForm organizationId={organizationId} serviceId={serviceId} unit={unit} preset={form} today={data.today}
          rates={rates} clients={clients} caregivers={caregivers}
          onClose={() => setForm(null)} onSaved={async () => { setForm(null); await load(); onChanged(); }} />
      )}
      {ending && data && (
        <EndRateModal organizationId={organizationId} rate={ending} today={data.today}
          onClose={() => setEnding(null)} onSaved={async () => { setEnding(null); await load(); onChanged(); }} />
      )}
    </Modal>
  );
}

function targetLabel(r: FinanceRate): string {
  if (r.scope === "client") return r.client_name ?? "Cliente";
  if (r.scope === "caregiver") return r.caregiver_name ?? "Cuidador";
  return "General";
}

function StatusPill({ status }: { status: FinanceRate["status"] }) {
  if (status === "current") return <Badge tone="success">Vigente</Badge>;
  if (status === "future") return <Badge tone="accent">Programada</Badge>;
  return <Badge>Anterior</Badge>;
}

function RateSection({ title, subtitle, unit, rates, actions, onAdd, onEnd, disabled }: {
  title: string; subtitle: string; unit: ServiceRates["service"]["unit"]; rates: FinanceRate[]; disabled: boolean;
  actions: Array<{ label: string; preset: FormPreset }>; onAdd: (p: FormPreset) => void; onEnd: (r: FinanceRate) => void;
}) {
  // In force first, then scheduled; within each, oldest start first.
  const order = (a: FinanceRate, b: FinanceRate) => (a.status === b.status ? a.effective_from.localeCompare(b.effective_from) : a.status === "current" ? -1 : 1);
  const general = rates.filter((r) => r.scope === "general").sort(order);
  const special = rates.filter((r) => r.scope !== "general").sort(order);
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-ivory-50)] p-4" aria-label={title}>
      <div>
        <h3 className="font-display text-[1.05rem] text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
      </div>
      {general.length === 0 && special.length === 0 && <p className="text-sm font-medium text-[var(--color-warning-700)]">Sin tarifa configurada.</p>}
      {[...general, ...special].map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">{targetLabel(r)}{r.day_type === "holiday" ? " · feriado" : ""}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Desde {formatDate(r.effective_from)}{r.effective_to ? ` hasta ${formatDate(r.effective_to)}` : ""}
              {r.min_minutes ? ` · mínimo ${r.min_minutes} min` : ""}{r.rounding_minutes ? ` · redondeo ${r.rounding_minutes} min` : ""}
              {r.half_day_policy ? ` · ${HALF_DAY_LABEL[r.half_day_policy]}${r.half_day_amount_cents != null ? ` (${formatCents(r.half_day_amount_cents)})` : ""}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tabular-nums">{rateWithUnit(r.amount_cents, unit)}</span>
            <StatusPill status={r.status} />
            {r.scope !== "general" && !r.effective_to && <Button size="sm" variant="ghost" onClick={() => onEnd(r)}>Terminar</Button>}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} size="sm" variant={a.preset.scope === "general" && a.preset.dayType === "standard" ? "primary" : "secondary"}
            icon={<Plus size={16} />} disabled={disabled} onClick={() => onAdd(a.preset)}>{a.label}</Button>
        ))}
      </div>
    </section>
  );
}

function RateForm({ organizationId, serviceId, unit, preset, today, rates, clients, caregivers, onClose, onSaved }: {
  organizationId: string; serviceId: string; unit: ServiceRates["service"]["unit"]; preset: FormPreset; today: string; rates: FinanceRate[];
  clients: BillingClient[]; caregivers: CaregiverRates[]; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [targetId, setTargetId] = useState(preset.targetId ?? "");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(today);
  const [minMinutes, setMinMinutes] = useState("");
  const [rounding, setRounding] = useState("");
  const [halfPolicy, setHalfPolicy] = useState<HalfDayPolicy>("review");
  const [halfAmount, setHalfAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const current = useMemo(() => rates.find((r) => r.rate_kind === preset.kind && r.scope === preset.scope && r.day_type === preset.dayType
    && r.status !== "past" && (preset.scope === "general" || (preset.scope === "client" ? r.billing_client_id === targetId : r.membership_id === targetId))), [rates, preset, targetId]);
  const cents = parseDollars(amount);
  const halfCents = halfPolicy === "fixed" ? parseDollars(halfAmount) : null;
  const needsReason = Boolean(current) || from < today;
  const valid = cents !== null && (preset.scope === "general" || Boolean(targetId)) && (!needsReason || reason.trim().length >= 3)
    && (halfPolicy !== "fixed" || unit !== "day" || halfCents !== null);

  const title = `${preset.dayType === "holiday" ? "Tarifa de feriado" : preset.scope === "client" ? "Precio especial por cliente" : preset.scope === "caregiver" ? "Excepción de pago por cuidador" : "Tarifa general"} · ${preset.kind === "client" ? "cobro" : "pago"}`;

  async function save() {
    const token = getToken(); if (!token || cents === null) return;
    const body: NewRate = {
      rateKind: preset.kind, scope: preset.scope, dayType: preset.dayType, amountCents: cents, effectiveFrom: from,
      billingClientId: preset.scope === "client" ? targetId : null, membershipId: preset.scope === "caregiver" ? targetId : null,
      reason: reason.trim() || undefined,
      ...(unit === "hour" ? { minMinutes: minMinutes ? Number(minMinutes) : null, roundingMinutes: rounding ? Number(rounding) : null } : {}),
      ...(unit === "day" ? { halfDayPolicy: halfPolicy, halfDayAmountCents: halfPolicy === "fixed" ? halfCents : null } : {}),
    };
    setSaving(true);
    try {
      const r = await financeApi.createRate(organizationId, serviceId, body, token);
      toast.show(r.closedPrevious
        ? `Desde el ${formatDate(from)}: ${formatCents(current?.amount_cents)} → ${formatCents(cents)}. Lo ya prestado conserva su precio.`
        : "Tarifa guardada.", "success");
      await onSaved();
    } catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={onClose} title={title} sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={!valid} onClick={() => void save()}>Guardar tarifa</Button></>}>
      <div className="flex flex-col gap-4">
        {preset.scope === "client" && (
          <Select label="Cliente" required value={targetId} onChange={(e) => setTargetId(e.target.value)}
            hint={clients.length === 0 ? "Primero añade el cliente en la pestaña «Clientes»." : undefined}>
            <option value="">Elige un cliente</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </Select>
        )}
        {preset.scope === "caregiver" && (
          <Select label="Cuidador/a" required value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Elige una persona del equipo</option>
            {caregivers.map((c) => <option key={c.membership_id} value={c.membership_id}>{c.display_name ?? "Cuidador/a"}</option>)}
          </Select>
        )}
        <Input label={`Importe ${UNIT_LABEL[unit]} (USD)`} required inputMode="decimal" placeholder="0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)} error={amount && cents === null ? "Escribe un importe como 25 o 25.50" : undefined}
          hint={current ? `Vigente ahora: ${rateWithUnit(current.amount_cents, unit)}` : undefined} />
        <Input label="Vigente desde" type="date" required value={from} onChange={(e) => setFrom(e.target.value)}
          hint={from < today ? "Fecha pasada: solo se permite para cubrir días sin tarifa, nunca para cambiar un precio ya vigente." : "Lo ya prestado antes de esta fecha conserva su precio."} />
        {unit === "hour" && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mínimo (minutos)" inputMode="numeric" placeholder="Opcional" value={minMinutes} onChange={(e) => setMinMinutes(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <Select label="Redondeo" value={rounding} onChange={(e) => setRounding(e.target.value)}>
              <option value="">Sin redondeo</option>
              {[5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>Hasta {m} min</option>)}
            </Select>
          </div>
        )}
        {unit === "day" && (
          <>
            <Select label="Día incompleto o medio día" value={halfPolicy} onChange={(e) => setHalfPolicy(e.target.value as HalfDayPolicy)}>
              {(Object.keys(HALF_DAY_LABEL) as HalfDayPolicy[]).map((p) => <option key={p} value={p}>{HALF_DAY_LABEL[p]}</option>)}
            </Select>
            {halfPolicy === "fixed" && (
              <Input label="Importe del medio día (USD)" inputMode="decimal" placeholder="0.00" value={halfAmount} onChange={(e) => setHalfAmount(e.target.value)}
                error={halfAmount && halfCents === null ? "Importe no válido" : undefined} />
            )}
          </>
        )}
        <Textarea label={needsReason ? "Motivo del cambio" : "Motivo (opcional)"} required={needsReason} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

function EndRateModal({ organizationId, rate, today, onClose, onSaved }: { organizationId: string; rate: FinanceRate; today: string; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast();
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    const token = getToken(); if (!token) return;
    setSaving(true);
    try { await financeApi.endRate(organizationId, rate.id, { effectiveTo: to, reason: reason.trim() }, token); toast.show("Tarifa terminada. Desde el día siguiente aplica la general.", "success"); await onSaved(); }
    catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Terminar · ${targetLabel(rate)}`} sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} disabled={reason.trim().length < 3} onClick={() => void save()}>Terminar tarifa</Button></>}>
      <div className="flex flex-col gap-4">
        <Input label="Último día vigente" type="date" value={to} min={rate.effective_from} onChange={(e) => setTo(e.target.value)} />
        <Textarea label="Motivo" required rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
}

function Simulator({ organizationId, serviceId, unit, clients, caregivers, today }: {
  organizationId: string; serviceId: string; unit: ServiceRates["service"]["unit"]; clients: BillingClient[]; caregivers: CaregiverRates[]; today: string;
}) {
  const [hours, setHours] = useState(unit === "day" ? "24" : "8");
  const [clientId, setClientId] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<Resolution | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = getToken(); if (!token) return;
    const minutesText = hours.trim().replace(",", ".");
    const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(minutesText);
    const minutes = match ? Number(match[1]) * 60 + Math.trunc((Number((match[2] ?? "").padEnd(2, "0")) * 60) / 100) : undefined;
    let cancelled = false;
    const t = window.setTimeout(() => {
      financeApi.resolve(organizationId, { serviceId, date, billingClientId: clientId || undefined, membershipId: membershipId || undefined, minutes }, token)
        .then((r) => { if (!cancelled) { setResult(r); setFailed(false); } }).catch(() => { if (!cancelled) setFailed(true); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [organizationId, serviceId, hours, clientId, membershipId, date]);

  const est = result?.estimate;
  const source = (s?: string) => (s === "client" ? "precio del cliente" : s === "caregiver" ? "excepción del cuidador" : s === "general" ? "tarifa general" : "");
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-[var(--color-navy-900)] p-4 text-white" aria-label="Simulador">
      <h3 className="flex items-center gap-2 font-display text-[1.05rem]"><Calculator size={18} aria-hidden />Simulador</h3>
      <div className="grid grid-cols-2 gap-3 [&_label]:text-white/80">
        <Input label="Duración (horas)" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        <Input label="Fecha del servicio" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select label="Cliente" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Tarifa general</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </Select>
        <Select label="Cuidador/a" value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
          <option value="">Tarifa general</option>
          {caregivers.map((c) => <option key={c.membership_id} value={c.membership_id}>{c.display_name ?? "Cuidador/a"}</option>)}
        </Select>
      </div>
      {failed ? <p className="text-sm text-white/70">No se pudo calcular.</p> : result && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[var(--radius-md)] bg-white/10 p-2.5">
            <dt className="text-[0.7rem] uppercase tracking-wide text-white/65">Cobro</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatCents(est?.billing?.amountCents ?? null)}</dd>
            <dd className="text-[0.7rem] text-white/60">{result.billing ? `${rateWithUnit(result.billing.amountCents, unit)} · ${source(result.billing.source)}` : "sin tarifa"}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] bg-white/10 p-2.5">
            <dt className="text-[0.7rem] uppercase tracking-wide text-white/65">Pago</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatCents(est?.pay?.amountCents ?? null)}</dd>
            <dd className="text-[0.7rem] text-white/60">{result.pay ? `${rateWithUnit(result.pay.amountCents, unit)} · ${source(result.pay.source)}` : "sin tarifa"}</dd>
          </div>
          <div className="rounded-[var(--radius-md)] bg-white/10 p-2.5">
            <dt className="text-[0.7rem] uppercase tracking-wide text-white/65">Margen bruto est.</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{est?.margin ? formatCents(est.margin.differenceCents) : "—"}</dd>
            <dd className="text-[0.7rem] text-white/60">{formatMargin(est?.margin ?? null).split(" · ")[1] ?? ""}</dd>
          </div>
        </dl>
      )}
      {result && (
        <p className="text-xs text-white/65">
          {est?.billing ? `Cantidad: ${hoursFromHundredths(est.billing.quantityHundredths)} ${unit === "hour" ? "h" : unit === "day" ? "día(s)" : "unidad"}. ` : ""}
          {result.holiday ? `Feriado: ${result.holiday}. ` : ""}
          {(est?.billing?.needsReview || est?.pay?.needsReview) ? "Día incompleto: la agencia decide cómo cobrarlo y pagarlo. " : ""}
          <CalendarClock size={12} className="inline" aria-hidden /> Se usa la tarifa vigente en la fecha del servicio (hora de Puerto Rico); un turno que cruza la medianoche usa la fecha en que empieza.
        </p>
      )}
    </section>
  );
}
