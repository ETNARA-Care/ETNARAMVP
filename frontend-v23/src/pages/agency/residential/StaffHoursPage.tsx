import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, Info, LockKeyhole, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { closePayPeriod, listFinancialRates, listPayPeriods, listTimesheets, previewPayPeriod, reviewTimesheet, saveStaffPayRate, type FinancialRate, type PayPeriod, type PayPeriodPreview, type Timesheet, type TimesheetSummary } from "@/api/timesheets";
import { Button, Card, PageHeader } from "@/components/ui";
import { formatMoney } from "@/i18n/format";

/**
 * F0.1 (hogares, 25-nov-2026): «Horas del personal». Misma ruta y mismo backend que «Horas y facturación» de la
 * agencia, limitado a lo aprobado (opción A):
 *   - registro, aprobación y exportación de horas trabajadas;
 *   - tarifa de PAGO por persona y cálculo ESTIMADO del pago por periodo.
 * Nunca tarifa de facturación, facturación a familias, deducciones, contribuciones ni nómina. El backend lo impone
 * igualmente (rechaza la tarifa de facturación en un hogar con 409 y no devuelve importes de facturación).
 */
const toDateInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const hours = (minutes: number) => (minutes / 60).toFixed(2);
const STATUSES = ["pending", "approved", "disputed"] as const;
const CADENCES = ["weekly", "biweekly", "custom"] as const;

export function StaffHoursPage() {
  const { roles } = useAuth();
  const { t } = useTranslation("residential");
  if (!roles.includes("ORGANIZATION_ADMIN")) {
    return (
      <div className="flex flex-col gap-[var(--spacing-md)]" data-testid="staff-hours-admin-only">
        <PageHeader title={t("staffHours.title")} description={t("staffHours.description")} />
        <Card>
          <p className="font-medium text-[var(--color-text-primary)]">{t("staffHours.adminOnlyTitle")}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("staffHours.adminOnlyDetail")}</p>
        </Card>
      </div>
    );
  }
  return <StaffHoursContent />;
}

function StaffHoursContent() {
  const { activeOrganization } = useAuth();
  const { t, i18n } = useTranslation("residential");
  const language = i18n.resolvedLanguage === "en" ? "en" : "es";
  const money = (cents: number | null | undefined) => (cents == null ? "—" : formatMoney(cents / 100, language));
  const organizationId = activeOrganization?.id;

  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 14);
  const [from, setFrom] = useState(toDateInput(past));
  const [to, setTo] = useState(toDateInput(now));
  const [status, setStatus] = useState("");
  const [cadence, setCadence] = useState("biweekly");
  const [rows, setRows] = useState<Timesheet[]>([]);
  const [rates, setRates] = useState<FinancialRate[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary | null>(null);
  const [preview, setPreview] = useState<PayPeriodPreview | null>(null);
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [periodWarning, setPeriodWarning] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token || !organizationId) return;
    setLoading(true); setError(false); setPeriodWarning(false);
    try {
      const [sheets, staffRates] = await Promise.all([listTimesheets(organizationId, from, to, status, token), listFinancialRates(organizationId, token)]);
      setRows(sheets.timesheets); setSummary(sheets.summary); setRates(staffRates); setPreview(null);
      const [p, h] = await Promise.allSettled([previewPayPeriod(organizationId, from, to, cadence, token), listPayPeriods(organizationId, token)]);
      if (p.status === "fulfilled" && p.value) setPreview(p.value); else { setPreview(null); setPeriodWarning(true); }
      if (h.status === "fulfilled") setPeriods(h.value); else setPeriodWarning(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId, from, to, status, cadence]);
  useEffect(() => { void load(); }, [load]);

  async function approve(sheet: Timesheet) {
    const token = getToken();
    if (!token || !organizationId) return;
    const raw = prompt(t("staffHours.promptMinutes"), String(sheet.recorded_minutes));
    if (raw === null) return;
    const minutes = Number(raw);
    let note: string | undefined;
    if (minutes !== sheet.recorded_minutes) { note = prompt(t("staffHours.promptAdjust")) || undefined; if (!note) return; }
    await reviewTimesheet(organizationId, sheet.id, "approved", token, minutes, note);
    await load();
  }
  async function dispute(sheet: Timesheet) {
    const token = getToken();
    if (!token || !organizationId) return;
    const note = prompt(t("staffHours.promptDispute"));
    if (!note) return;
    await reviewTimesheet(organizationId, sheet.id, "disputed", token, undefined, note);
    await load();
  }
  // Solo la tarifa de pago: nunca se pide ni se envía una tarifa de facturación.
  async function editPayRate(rate: FinancialRate) {
    const token = getToken();
    if (!token || !organizationId) return;
    const raw = prompt(t("staffHours.promptPayRate"), rate.pay_rate_cents == null ? "" : String(rate.pay_rate_cents / 100));
    if (raw === null) return;
    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 1000) { alert(t("staffHours.invalidRate")); return; }
    try { await saveStaffPayRate(organizationId, rate.membership_id, Math.round(value * 100), token); } catch { alert(t("staffHours.errorRate")); }
    await load();
  }
  async function closePeriod() {
    const token = getToken();
    if (!token || !organizationId || !preview) return;
    if (preview.exceptions.pending || preview.exceptions.disputed) { alert(t("staffHours.resolveFirst")); return; }
    if (!confirm(t("staffHours.confirmClose", { from, to }))) return;
    try {
      await closePayPeriod(organizationId, from, to, cadence, token);
      await load();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      alert(code === "PAY_PERIOD_OVERLAP" ? t("staffHours.errorOverlap") : code === "PAY_PERIOD_ALREADY_EXISTS" ? t("staffHours.errorExists") : t("staffHours.errorClose"));
    }
  }
  // Exportación de horas: persona, horas aprobadas, pago estimado y hojas. Sin columna de facturación.
  function exportCsv() {
    if (!preview) return;
    const lines = [
      [t("staffHours.csv.worker"), t("staffHours.csv.approvedHours"), t("staffHours.csv.estimatedPay"), t("staffHours.csv.sheets")],
      ...preview.workers.map((w) => [w.workerName, hours(w.approvedMinutes), (w.payAmountCents / 100).toFixed(2), String(w.timesheets)]),
    ];
    const blob = new Blob([lines.map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `etnara-horas-personal-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const missing = rates.filter((r) => r.membership_status === "active" && r.pay_rate_cents == null);
  const missingNames = missing.map((r) => r.display_name || t("staffHours.someone"));
  const missingList = missingNames.length <= 1 ? (missingNames[0] ?? "") : `${missingNames.slice(0, -1).join(", ")} ${t("staffHours.and")} ${missingNames[missingNames.length - 1]}`;
  const exceptions = preview ? preview.exceptions.pending + preview.exceptions.disputed : 0;

  return (
    <div className="flex flex-col gap-[var(--spacing-lg)]" data-testid="staff-hours">
      <PageHeader title={t("staffHours.title")} description={t("staffHours.description")}
        actions={<Button variant="secondary" icon={<RefreshCw size={18} />} onClick={() => void load()} loading={loading}>{t("staffHours.refresh")}</Button>} />
      <Card data-testid="staff-hours-estimate-notice" className="border-[var(--color-navy-700)]/20 bg-[var(--color-ivory-100)]">
        <p className="flex items-start gap-2 text-sm font-medium text-[var(--color-text-primary)]"><Info size={17} className="mt-0.5 shrink-0" aria-hidden />{t("staffHours.estimateNotice")}</p>
      </Card>
      <div className="flex flex-wrap gap-3">
        <label>{t("staffHours.from")} <input className="border rounded p-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>{t("staffHours.to")} <input className="border rounded p-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <select className="border rounded p-2" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("staffHours.sheetsTitle")}>
          <option value="">{t("staffHours.statusAll")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`staffHours.status.${s}`)}</option>)}
        </select>
      </div>
      {error && <Card><p className="text-red-700">{t("staffHours.loadFailed")}</p></Card>}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>{t("staffHours.recorded")}<br /><b>{t("staffHours.hours", { value: hours(summary.recordedMinutes) })}</b></Card>
          <Card>{t("staffHours.approved")}<br /><b>{t("staffHours.hours", { value: hours(summary.approvedMinutes) })}</b></Card>
          <Card>{t("staffHours.estimatedPay")}<br /><b>{money(summary.approvedPayCents)}</b></Card>
        </div>
      )}
      {periodWarning && !preview && (
        <Card>
          <p className="font-medium text-[var(--color-warning-700)]">{t("staffHours.periodUnavailableTitle")}</p>
          <p className="text-sm mt-1">{t("staffHours.periodUnavailableDetail")}</p>
          <Button variant="secondary" className="mt-3" icon={<RefreshCw size={17} />} onClick={() => void load()}>{t("staffHours.retry")}</Button>
        </Card>
      )}
      {missing.length > 0 && (
        <Card className="border-[var(--color-warning-700)]/30 bg-[var(--color-warning-100)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-warning-700)]">{missing.length === 1 ? t("staffHours.missingRateOne", { names: missingList }) : t("staffHours.missingRateMany", { names: missingList })}</p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("staffHours.missingRateDetail")}</p>
            </div>
            <Button variant="secondary" onClick={() => void editPayRate(missing[0])}>{t("staffHours.setRate")}</Button>
          </div>
        </Card>
      )}
      {preview && (
        <Card>
          <div className="flex flex-wrap justify-between gap-3">
            <div><h2 className="font-display text-lg">{t("staffHours.periodTitle")}</h2><p className="text-sm">{t("staffHours.periodDetail")}</p></div>
            <select className="border rounded p-2" value={cadence} onChange={(e) => setCadence(e.target.value)} aria-label={t("staffHours.periodTitle")}>
              {CADENCES.map((c) => <option key={c} value={c}>{t(`staffHours.cadence.${c}`)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 my-4 sm:grid-cols-3">
            <div>{t("staffHours.approvedHours")}<br /><b>{t("staffHours.hours", { value: hours(preview.summary.approvedMinutes) })}</b></div>
            <div>{t("staffHours.estimatedPay")}<br /><b>{money(preview.summary.payAmountCents)}</b></div>
            <div>{t("staffHours.exceptions")}<br /><b>{exceptions}</b></div>
          </div>
          {preview.workers.map((w) => (
            <div key={w.workerName} className="border-t py-3"><b>{w.workerName}</b> · {t("staffHours.workerLine", { hours: hours(w.approvedMinutes), pay: money(w.payAmountCents) })}</div>
          ))}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button icon={<LockKeyhole size={17} />} onClick={() => void closePeriod()} disabled={exceptions > 0}>{t("staffHours.closePeriod")}</Button>
            <Button variant="secondary" onClick={exportCsv}>{t("staffHours.exportCsv")}</Button>
          </div>
          {exceptions > 0 && <p className="text-sm mt-2">{t("staffHours.beforeClosing", { pending: preview.exceptions.pending, disputed: preview.exceptions.disputed })}</p>}
          {periodWarning && <p className="text-sm mt-2">{t("staffHours.historyUnavailable")}</p>}
        </Card>
      )}
      <Card>
        <h2 className="font-display text-lg mb-3">{t("staffHours.closedTitle")}</h2>
        {periods.length === 0 ? <p className="text-sm">{t("staffHours.closedEmpty")}</p> : periods.map((p) => (
          <div key={p.id} className="border-b py-3"><b>{p.date_from} — {p.date_to}</b> · {t("staffHours.closedLine", { hours: hours(p.approved_minutes), pay: money(p.pay_amount_cents) })}</div>
        ))}
      </Card>
      <Card>
        <h2 className="font-display text-lg mb-3">{t("staffHours.sheetsTitle")}</h2>
        {rows.length === 0 ? <p>{t("staffHours.sheetsEmpty")}</p> : (
          <div className="flex flex-col gap-3">
            {rows.map((sheet) => (
              <div key={sheet.id} className="border-b pb-3">
                <b>{sheet.worker_name || t("staffHours.personFallback")}</b> · {sheet.recipient_name || t("staffHours.noResident")} · {t("staffHours.hours", { value: hours(sheet.recorded_minutes) })} · {t(`staffHours.status.${sheet.status}`)}
                {sheet.recorded_offline && <span className="ml-2 text-[var(--text-caption)] font-medium text-[var(--color-warning-700)]">{t("staffHours.offline")}</span>}
                {sheet.status !== "approved" && (
                  <div className="mt-2"><Button onClick={() => void approve(sheet)}>{t("staffHours.approve")}</Button> <Button variant="secondary" onClick={() => void dispute(sheet)}>{t("staffHours.dispute")}</Button></div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="font-display text-lg mb-1 flex items-center gap-2"><DollarSign size={18} />{t("staffHours.ratesTitle")}</h2>
        <p className="text-sm mb-3">{t("staffHours.ratesDetail")}</p>
        {rates.map((r) => (
          <div key={r.membership_id} className="flex justify-between items-center border-b py-3">
            <span>
              <b>{r.display_name || t("staffHours.personFallback")}</b><br />
              <small>{t("staffHours.rateLine", { pay: money(r.pay_rate_cents) })}</small>
              {r.pay_rate_cents == null && <><br /><small className="font-medium text-[var(--color-warning-700)]">{t("staffHours.rateMissing")}</small></>}
            </span>
            <Button variant="secondary" onClick={() => void editPayRate(r)}>{t("staffHours.edit")}</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
