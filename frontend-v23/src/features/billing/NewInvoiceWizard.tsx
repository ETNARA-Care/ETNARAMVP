import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getToken } from "@/auth/token";
import { billingDraftsApi, type BillingClientOption, type EligibleShift } from "@/api/billing";
import { Button, Input, Modal, Select, Skeleton, useToast } from "@/components/ui";
import { LOCALE_TAG } from "@/i18n/language";
import { day, errorText, langOf, money } from "./billingFormat";
import { EligibleShifts } from "./EligibleShifts";

const todayPR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

/**
 * Nueva factura (F2.2): Cliente → Período → Turnos → Revisar. Full screen on
 * iPhone. Creating the draft and adding the selected shifts are two calls; if a
 * shift was reserved by someone else in between, the draft still exists and
 * opens so the agency sees what happened.
 */
export function NewInvoiceWizard({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<BillingClientOption[] | null>(null);
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(monthStart(todayPR()));
  const [to, setTo] = useState(todayPR());
  const [shifts, setShifts] = useState<EligibleShift[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = getToken(); if (!token) return;
    billingDraftsApi.clients(organizationId, token).then((r) => setClients(r.clients)).catch(() => setClients([]));
  }, [organizationId]);

  async function loadShifts() {
    const token = getToken(); if (!token) return;
    setShifts(null);
    try { setShifts((await billingDraftsApi.eligible(organizationId, { billingClientId: clientId, from, to }, token)).shifts); setSelected(new Set()); setStep(3); }
    catch (e) { toast.show(errorText(t, e), "danger"); }
  }
  const chosen = useMemo(() => (shifts ?? []).filter((s) => selected.has(s.shiftId)), [shifts, selected]);
  const total = chosen.reduce((sum, s) => sum + (s.amountCents ?? 0), 0);
  const client = clients?.find((c) => c.id === clientId);

  async function create() {
    const token = getToken(); if (!token) return;
    setBusy(true);
    try {
      const { invoice } = await billingDraftsApi.create(organizationId, { billingClientId: clientId, periodFrom: from, periodTo: to }, token);
      if (chosen.length) {
        try { await billingDraftsApi.addShifts(organizationId, invoice.id, { expectedVersion: 1, shiftIds: chosen.map((s) => s.shiftId) }, token); }
        catch (e) { toast.show(errorText(t, e), "danger"); }
      }
      onCreated(invoice.id);
    } catch (e) { toast.show(errorText(t, e), "danger"); } finally { setBusy(false); }
  }

  const periodOk = from && to && to >= from;
  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="secondary" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>{step === 1 ? t("wizard.cancel") : t("wizard.back")}</Button>
      {step === 1 && <Button disabled={!clientId} onClick={() => setStep(2)}>{t("wizard.next")}</Button>}
      {step === 2 && <Button disabled={!periodOk} onClick={() => void loadShifts()}>{t("wizard.next")}</Button>}
      {step === 3 && <Button onClick={() => setStep(4)}>{t("wizard.review")}</Button>}
      {step === 4 && <Button loading={busy} onClick={() => void create()} data-wizard-create>{busy ? t("wizard.creating") : t("wizard.create")}</Button>}
    </div>
  );

  return (
    <Modal open onClose={onClose} title={t("wizard.title")} eyebrow={t("wizard.step", { n: step })} fullScreenOnMobile footer={footer}>
      <div className="flex min-w-0 flex-col gap-4" data-wizard-step={step}>
        {step === 1 && (!clients ? <Skeleton className="h-16" /> : clients.length === 0 ? <p className="text-sm">{t("wizard.noClients")}</p> : (
          <div className="flex flex-col gap-2">
            <Select label={t("wizard.client")} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">{t("wizard.chooseClient")}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {client && client.recipients.length > 0 && <p className="break-words text-sm text-[var(--color-text-secondary)]">{t("wizard.residents", { names: client.recipients.map((r) => r.name ?? "—").join(", ") })}</p>}
          </div>
        ))}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="font-medium">{t("wizard.period")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              <Input type="date" lang={LOCALE_TAG[lang]} label={t("wizard.from")} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" lang={LOCALE_TAG[lang]} label={t("wizard.to")} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("wizard.periodHint")}</p>
          </div>
        )}
        {step === 3 && (!shifts ? <Skeleton className="h-32" /> : shifts.length === 0 ? <p className="text-sm">{t("wizard.noShifts")}</p> : (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{t("wizard.shifts")}</p>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(shifts.filter((s) => s.selectable).map((s) => s.shiftId)))}>{t("wizard.selectAll")}</Button>
            </div>
            <EligibleShifts shifts={shifts} selected={selected} onToggle={(id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })} />
          </div>
        ))}
        {(step === 3 || step === 4) && shifts && (
          <div className="sticky bottom-0 -mx-1 flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-navy-900)] px-4 py-3 text-white" data-wizard-total>
            <span className="text-sm">{t("wizard.selected", { count: chosen.length })}</span>
            <span className="font-semibold tabular-nums">{money(total, lang)}</span>
          </div>
        )}
        {step === 4 && (
          <div className="flex flex-col gap-2 text-sm">
            <p><span className="text-[var(--color-text-muted)]">{t("draft.client")}:</span> <span className="font-medium">{client?.name}</span></p>
            <p><span className="text-[var(--color-text-muted)]">{t("draft.period")}:</span> {day(from, lang)} – {day(to, lang)}</p>
            <p className="text-[var(--color-text-secondary)]">{t("draft.issueLater")}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
