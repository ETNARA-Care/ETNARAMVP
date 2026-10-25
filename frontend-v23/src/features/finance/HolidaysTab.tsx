import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { getToken } from "@/auth/token";
import { financeApi } from "@/api/finance";
import { Button, EmptyState, ErrorState, Input, Skeleton, useToast } from "@/components/ui";
import { financeErrorText, formatDate } from "./money";

/**
 * Optional agency holiday calendar. ETNARA does not assume any official list:
 * each agency decides which days are holidays. On those days (backend 119):
 * holiday rate of that client/caregiver → their normal agreed rate →
 * general holiday rate → general normal rate.
 */
export function HolidaysTab({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Array<{ date: string; name: string }> | null>(null);
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setRows((await financeApi.listHolidays(organizationId, token)).holidays); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function add() {
    const token = getToken(); if (!token || !date || name.trim().length < 2) return;
    setSaving(true);
    try { await financeApi.addHoliday(organizationId, { date, name: name.trim() }, token); setDate(""); setName(""); toast.show("Feriado añadido.", "success"); await load(); }
    catch (e) { toast.show(financeErrorText(e), "danger"); } finally { setSaving(false); }
  }

  if (failed) return <ErrorState kind="server" onRetry={() => void load()} />;
  return (
    <section className="flex flex-col gap-4" aria-label="Feriados">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Opcional. Marca los días que tu agencia cobra o paga distinto. Solo afecta a los servicios que tengan una «Tarifa de feriado».
        Un precio acordado con un cliente (o una excepción de un cuidador) se mantiene en feriado, salvo que ese cliente o cuidador tenga su propia tarifa de feriado.
      </p>
      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Nombre" maxLength={80} placeholder="Ej.: Día de Acción de Gracias" value={name} onChange={(e) => setName(e.target.value)} />
        <Button icon={<CalendarPlus size={18} />} loading={saving} disabled={!date || name.trim().length < 2} onClick={() => void add()}>Añadir</Button>
      </div>
      {!rows ? <Skeleton className="h-24" /> : rows.length === 0 ? <EmptyState title="Sin feriados" description="Todos los días usan la tarifa normal." /> : (
        <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {rows.map((h) => (
            <li key={h.date} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium">{h.name}</span>
              <span className="tabular-nums text-[var(--color-text-secondary)]">{formatDate(h.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
