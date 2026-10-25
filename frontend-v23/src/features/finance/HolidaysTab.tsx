import { useCallback, useEffect, useState } from "react";
import { CalendarOff, CalendarPlus, RotateCcw } from "lucide-react";
import { getToken } from "@/auth/token";
import { financeApi, type FinanceHoliday } from "@/api/finance";
import { Button, EmptyState, ErrorState, Input, Modal, Skeleton, Textarea, useToast } from "@/components/ui";
import { financeErrorText, formatDate } from "./money";

/**
 * Optional agency holiday calendar. ETNARA does not assume any official list:
 * each agency decides which days are holidays. On those days (backend 119):
 * holiday rate of that client/caregiver → their normal agreed rate →
 * general holiday rate → general normal rate.
 * F1.1 (backend 120): a holiday added by mistake is deactivated with a reason,
 * never deleted; adding the date again reactivates it.
 */
export function HolidaysTab({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<FinanceHoliday[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<FinanceHoliday | null>(null);
  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setRows((await financeApi.listHolidays(organizationId, token)).holidays); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const active = (rows ?? []).filter((h) => h.active !== false);
  const inactive = (rows ?? []).filter((h) => h.active === false);

  async function add(target = { date, name: name.trim() }) {
    const token = getToken(); if (!token || !target.date || target.name.length < 2) return;
    const wasInactive = inactive.some((h) => h.date === target.date);
    setSaving(true);
    try {
      await financeApi.addHoliday(organizationId, target, token);
      setDate(""); setName("");
      toast.show(wasInactive ? "Feriado reactivado." : "Feriado añadido.", "success");
      await load();
    } catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }

  if (failed) return <ErrorState kind="server" onRetry={() => void load()} />;
  return (
    <section className="flex flex-col gap-4" aria-label="Feriados">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Opcional. Marca los días que tu agencia cobra o paga distinto. Solo afecta a los servicios que tengan una «Tarifa de feriado».
        Un precio acordado con un cliente (o una excepción de un cuidador) se mantiene en feriado, salvo que ese cliente o cuidador tenga su propia tarifa de feriado.
      </p>
      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-[180px_1fr_auto] sm:items-end [&>*]:min-w-0">
        <Input label="Fecha" type="date" className="min-w-0 appearance-none" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Nombre" maxLength={80} placeholder="Ej.: Día de Acción de Gracias" value={name} onChange={(e) => setName(e.target.value)} />
        <Button icon={<CalendarPlus size={18} />} loading={saving} disabled={!date || name.trim().length < 2} onClick={() => void add()}>Añadir</Button>
      </div>
      {!rows ? <Skeleton className="h-24" /> : active.length === 0 ? <EmptyState title="Sin feriados" description="Todos los días usan la tarifa normal." /> : (
        <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {active.map((h) => (
            <li key={h.date} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{h.name}</p>
                <p className="tabular-nums text-xs text-[var(--color-text-secondary)]">{formatDate(h.date)}</p>
              </div>
              <Button size="sm" variant="ghost" icon={<CalendarOff size={16} />} onClick={() => setDeactivating(h)}>Desactivar</Button>
            </li>
          ))}
        </ul>
      )}
      {inactive.length > 0 && (
        <details className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-ivory-50)] px-4 py-3 text-sm" data-inactive-holidays>
          <summary className="cursor-pointer font-medium text-[var(--color-text-secondary)]">Desactivados ({inactive.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {inactive.map((h) => (
              <li key={h.date} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-secondary)] line-through decoration-1">{h.name} · {formatDate(h.date)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Motivo: {h.deactivation_reason}{h.deactivated_by_email ? ` · ${h.deactivated_by_email}` : ""}</p>
                </div>
                <Button size="sm" variant="ghost" icon={<RotateCcw size={16} />} disabled={saving} onClick={() => void add({ date: h.date, name: h.name })}>Reactivar</Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {deactivating && (
        <DeactivateHolidayModal organizationId={organizationId} holiday={deactivating}
          onClose={() => setDeactivating(null)} onSaved={async () => { setDeactivating(null); await load(); }} />
      )}
    </section>
  );
}

function DeactivateHolidayModal({ organizationId, holiday, onClose, onSaved }: {
  organizationId: string; holiday: FinanceHoliday; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    const token = getToken(); if (!token) return;
    setSaving(true);
    try {
      await financeApi.deactivateHoliday(organizationId, holiday.date, reason.trim(), token);
      toast.show("Feriado desactivado. Ese día vuelve a usar la tarifa normal.", "success");
      await onSaved();
    } catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title="Desactivar feriado" sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>Volver</Button>
        <Button variant="danger" loading={saving} disabled={reason.trim().length < 3} onClick={() => void save()}>Desactivar</Button></>}>
      <div className="flex flex-col gap-4" data-deactivate-holiday>
        <p className="text-sm"><strong>{holiday.name}</strong> · {formatDate(holiday.date)}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Ese día volverá a usar las tarifas normales. El feriado no se borra: queda en «Desactivados» con su motivo y puedes reactivarlo.
        </p>
        <Textarea label="Motivo" required rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Ej.: se añadió por error" />
      </div>
    </Modal>
  );
}
