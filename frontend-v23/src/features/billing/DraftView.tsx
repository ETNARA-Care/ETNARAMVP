import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Ban, Clock, FileClock, Minus, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { getToken } from "@/auth/token";
import { billingDraftsApi, type BillingClientOption, type BillingServiceOption, type EligibleShift, type InvoiceDetail, type InvoiceLine, type TaxTreatment } from "@/api/billing";
import { Badge, Button, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { LOCALE_TAG } from "@/i18n/language";
import { day, errorText, hours, langOf, money, parseMoney, parsePercent, parseQuantity, percent, taxLabel, time, tx } from "./billingFormat";
import { EligibleShifts, Segments } from "./EligibleShifts";

type Dialog = null | { kind: "remove"; line: InvoiceLine } | { kind: "discard" } | { kind: "recover" } | { kind: "manual"; discount: boolean } | { kind: "shifts" } | { kind: "edit" };

/**
 * One draft (F2.2): lines (shift / manual / discount) with the overnight
 * segments, amounts always visible, warnings and what would block issuing.
 * Every change sends the version the screen shows; if someone else changed
 * the draft the backend answers DRAFT_CHANGED and the screen reloads.
 */
export function DraftView({ organizationId, invoiceId, canManageTax, onClose }: { organizationId: string; invoiceId: string; canManageTax: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const toast = useToast();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  void canManageTax;

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setData(await billingDraftsApi.get(organizationId, invoiceId, token)); } catch (e) { toast.show(errorText(t, e), "danger"); }
  }, [organizationId, invoiceId, toast, t]);
  useEffect(() => { void load(); }, [load]);

  /** Runs a change; on DRAFT_CHANGED reloads and says so. */
  async function act(work: (token: string, version: number) => Promise<unknown>, ok: string) {
    const token = getToken(); if (!token || !data) return false;
    setBusy(true);
    try { await work(token, data.invoice.version); toast.show(ok, "success"); setDialog(null); await load(); return true; }
    catch (e) { toast.show(errorText(t, e), "danger"); if ((e as { code?: string })?.code === "DRAFT_CHANGED") await load(); return false; }
    finally { setBusy(false); }
  }

  const inv = data?.invoice;
  const editable = Boolean(data?.canEdit);
  const anyRateChanged = data?.lines.some((l) => l.rateChanged);

  return (
    <Modal open onClose={onClose} fullScreenOnMobile wide eyebrow={inv ? `${t(`invoices.status.${inv.status}`)} · ${t("draft.version", { n: inv.version })}` : undefined}
      title={inv?.clientName ?? t("draft.title")}>
      {!data || !inv ? <Skeleton className="h-64" /> : (
        <div className="flex min-w-0 flex-col gap-4" data-draft={inv.id} data-version={inv.version}>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-secondary)]">
            <span>{t("draft.period")}: <span className="font-medium text-[var(--color-text-primary)]">{day(inv.periodFrom, lang)} – {day(inv.periodTo, lang)}</span></span>
            {inv.notes && <span className="min-w-0 break-words">· {inv.notes}</span>}
            {editable && <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "edit" })}>{t("draft.edit")}</Button>}
          </div>

          {inv.status === "discarded" && <p className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-sm" data-draft-discarded><Ban size={14} className="mr-1 inline" aria-hidden />{t("draft.discarded", { reason: inv.discardReason ?? "" })}</p>}
          {inv.inactive && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-ivory-50)] p-3 text-sm" data-draft-inactive>
              <Clock size={16} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1"><p>{t("invoices.inactiveHelp", { days: inv.inactiveDays })}</p>
                {editable && <Button size="sm" variant="secondary" className="mt-2" onClick={() => setDialog({ kind: "recover" })}>{t("draft.recover")}</Button>}</div>
            </div>
          )}
          {anyRateChanged && editable && (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm" data-rate-changed>
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
              <div className="min-w-0 flex-1"><p>{t("draft.rateChangedAll")}</p>
                <Button size="sm" variant="secondary" className="mt-2" icon={<RefreshCcw size={14} />} loading={busy}
                  onClick={() => void act((tk, v) => billingDraftsApi.recalculate(organizationId, inv.id, { expectedVersion: v }, tk), t("draft.recalculated", { count: data.lines.filter((l) => l.rateChanged).length }))}>{t("draft.recalculate")}</Button></div>
            </div>
          )}

          {editable && (
            <div className="grid grid-cols-3 gap-2" data-draft-actions>
              <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setDialog({ kind: "shifts" })}>{t("draft.addShifts")}</Button>
              <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => setDialog({ kind: "manual", discount: false })}>{t("draft.addManual")}</Button>
              <Button size="sm" variant="secondary" icon={<Minus size={15} />} onClick={() => setDialog({ kind: "manual", discount: true })}>{t("draft.addDiscount")}</Button>
            </div>
          )}

          <ul className="flex min-w-0 flex-col gap-2" data-draft-lines>
            {data.lines.map((l) => (
              <li key={l.id} data-line={l.id} data-kind={l.kind} className="min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={l.kind === "shift" ? "neutral" : l.kind === "discount" ? "warning" : "accent"}>{t(`draft.kind.${l.kind}`)}</Badge>
                      <span className="text-xs text-[var(--color-text-muted)]">{day(l.service_date, lang)}</span>
                    </div>
                    <p className="mt-1 break-words text-sm font-medium leading-snug">{l.description}</p>
                    {l.kind === "shift" && l.real_start && l.real_end && (
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("draft.real", { from: time(l.real_start, lang), to: time(l.real_end, lang) })}{l.approved_minutes ? ` · ${hours(l.approved_minutes)}` : ""}</p>
                    )}
                    {l.kind !== "shift" && <p className="text-xs text-[var(--color-text-secondary)]">{t("draft.quantity", { qty: (l.quantity_hundredths / 100).toLocaleString(LOCALE_TAG[lang]), price: money(l.unit_price_cents ?? 0, lang) })}</p>}
                    {l.justification && <p className="mt-0.5 break-words text-xs text-[var(--color-text-muted)]">{t("draft.justification")}: {l.justification}</p>}
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">IVU · {taxLabel(t, l.tax_treatment, l.tax_rate_basis_points, lang)}{l.tax_legal_basis ? ` · ${l.tax_legal_basis}` : ""}</p>
                    {l.needs_review && (
                      <ul className="mt-1 flex flex-wrap gap-1" data-line-review>{l.review_reasons.map((r) => <li key={r}><Badge tone="warning">{tx(t, `exceptions.${r}`, "blockers.NEEDS_REVIEW")}</Badge></li>)}</ul>
                    )}
                    {l.rateChanged && <p className="mt-1 text-xs text-amber-700">{t("draft.rateChanged")}</p>}
                    {l.warnings.map((w) => <p key={w.code} className="mt-1 text-xs text-amber-700">{tx(t, `warnings.${w.code}`, "draft.rateChanged", { minutes: w.minutes })}</p>)}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{money(l.amount_cents, lang)}</span>
                    {editable && <button type="button" className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-[var(--color-danger-700)] hover:bg-[var(--color-ivory-100)]" onClick={() => setDialog({ kind: "remove", line: l })} aria-label={`${t("draft.remove")} ${l.description}`}><Trash2 size={13} aria-hidden />{t("draft.remove")}</button>}
                  </div>
                </div>
                {l.segments.length > 1 && <Segments rows={l.segments.map((s) => ({ date: s.segment_date, startsAt: s.starts_at, endsAt: s.ends_at, minutes: s.minutes, amount: s.amount_cents, holiday: s.holiday_name, source: s.rate_source, price: s.unit_price_cents }))} />}
              </li>
            ))}
          </ul>

          <Totals data={data} lang={lang} />

          {data.issueBlockers.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 text-sm" data-issue-blockers>
              <p className="flex items-center gap-1.5 font-semibold"><FileClock size={15} aria-hidden />{t("draft.blockersTitle")}</p>
              <ul className="mt-1 list-disc pl-5 text-[var(--color-text-secondary)]">{data.issueBlockers.map((b) => <li key={b} data-blocker={b}>{tx(t, `blockers.${b}`, "draft.issueLater")}</li>)}</ul>
            </div>
          )}

          {data.removedLines.length > 0 && (
            <details className="text-sm" data-removed-lines><summary className="cursor-pointer text-[var(--color-text-secondary)]">{t("draft.removed", { count: data.removedLines.length })}</summary>
              <ul className="mt-1 space-y-1 text-xs text-[var(--color-text-muted)]">{data.removedLines.map((r) => <li key={r.id} className="break-words">{r.description} · {money(r.amountCents, lang)}{r.reason ? ` · ${r.reason}` : ""}</li>)}</ul></details>
          )}

          {editable && <Button variant="ghost" className="self-start text-[var(--color-danger-700)]" icon={<Ban size={15} />} onClick={() => setDialog({ kind: "discard" })} data-draft-discard>{t("draft.discard")}</Button>}
        </div>
      )}

      {data && inv && dialog?.kind === "remove" && (
        <ReasonDialog title={t("draft.removeTitle")} body={dialog.line.description} label={t("draft.reasonOptional")} required={false} busy={busy} confirm={t("draft.remove")} danger
          onClose={() => setDialog(null)} onConfirm={(reason) => void act((tk, v) => billingDraftsApi.removeLine(organizationId, inv.id, dialog.line.id, { expectedVersion: v, reason: reason || undefined }, tk), t("draft.lineRemoved"))} />
      )}
      {data && inv && dialog?.kind === "discard" && (
        <ReasonDialog title={t("draft.discardTitle")} body={t("draft.discardBody")} label={t("draft.reason")} required busy={busy} confirm={t("draft.discard")} danger
          onClose={() => setDialog(null)} onConfirm={(reason) => void act((tk, v) => billingDraftsApi.discard(organizationId, inv.id, { expectedVersion: v, reason }, tk), t("draft.discardedOk"))} />
      )}
      {data && inv && dialog?.kind === "recover" && (
        <ReasonDialog title={t("draft.recoverTitle")} body={t("draft.recoverBody", { days: inv.inactiveDays })} label={t("draft.reason")} required busy={busy} confirm={t("draft.recover")} danger
          onClose={() => setDialog(null)} onConfirm={(reason) => void act((tk, v) => billingDraftsApi.recover(organizationId, inv.id, { expectedVersion: v, reason }, tk), t("draft.recovered"))} />
      )}
      {data && inv && dialog?.kind === "edit" && (
        <EditDialog data={data} busy={busy} onClose={() => setDialog(null)}
          onSave={(body) => void act((tk, v) => billingDraftsApi.update(organizationId, inv.id, { expectedVersion: v, ...body }, tk), t("draft.updated"))} />
      )}
      {data && inv && dialog?.kind === "shifts" && (
        <AddShiftsDialog organizationId={organizationId} data={data} busy={busy} onClose={() => setDialog(null)}
          onAdd={(ids) => void act((tk, v) => billingDraftsApi.addShifts(organizationId, inv.id, { expectedVersion: v, shiftIds: ids }, tk), t("draft.linesAdded"))} />
      )}
      {data && inv && dialog?.kind === "manual" && (
        <ManualDialog organizationId={organizationId} data={data} discount={dialog.discount} busy={busy} onClose={() => setDialog(null)}
          onAdd={(body) => void act((tk, v) => billingDraftsApi.addManual(organizationId, inv.id, { ...body, expectedVersion: v }, tk), t("draft.lineAdded"))} />
      )}
    </Modal>
  );
}

function Totals({ data, lang }: { data: InvoiceDetail; lang: "es" | "en" }) {
  const { t } = useTranslation("billing");
  const tot = data.totals;
  return (
    <div className="sticky bottom-0 z-10 rounded-[var(--radius-md)] bg-[var(--color-navy-900)] p-4 text-white shadow-[var(--shadow-card)]" data-draft-totals>
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-white/70">{t("draft.totals")}</p>
      <dl className="mt-1 space-y-0.5 text-sm">
        <div className="flex justify-between gap-2"><dt>{t("draft.subtotal")}</dt><dd className="tabular-nums" data-subtotal>{money(tot.subtotalCents, lang)}</dd></div>
        {tot.taxes.map((x) => <div key={x.rateBasisPoints} className="flex justify-between gap-2 text-white/85"><dt>{t("draft.tax", { rate: percent(x.rateBasisPoints, lang), base: money(x.baseCents, lang) })}</dt><dd className="tabular-nums">{money(x.taxCents, lang)}</dd></div>)}
        {tot.exemptBaseCents !== 0 && <div className="flex justify-between gap-2 text-white/85"><dt>{t("draft.exempt")}</dt><dd className="tabular-nums">{money(tot.exemptBaseCents, lang)}</dd></div>}
        {tot.taxPending && <div className="flex justify-between gap-2 text-amber-200"><dt>{t("draft.pending")}</dt><dd className="tabular-nums">{money(tot.pendingBaseCents, lang)}</dd></div>}
        <div className="flex justify-between gap-2 border-t border-white/20 pt-1 text-base font-semibold"><dt>{t("draft.total")}</dt><dd className="tabular-nums" data-total>{money(tot.totalCents, lang)}</dd></div>
      </dl>
    </div>
  );
}

function ReasonDialog({ title, body, label, required, busy, confirm, danger, onClose, onConfirm }: { title: string; body: string; label: string; required: boolean; busy: boolean; confirm: string; danger?: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const { t } = useTranslation("billing");
  const [reason, setReason] = useState("");
  return (
    <Modal open onClose={onClose} title={title} sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>{t("permissions.cancel")}</Button><Button variant={danger ? "danger" : "primary"} loading={busy} disabled={busy || (required && reason.trim().length < 3)} onClick={() => onConfirm(reason.trim())}>{confirm}</Button></>}>
      <div className="flex flex-col gap-3"><p className="break-words text-sm text-[var(--color-text-secondary)]">{body}</p><Textarea label={label} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
    </Modal>
  );
}

function EditDialog({ data, busy, onClose, onSave }: { data: InvoiceDetail; busy: boolean; onClose: () => void; onSave: (body: { periodFrom: string; periodTo: string; notes: string | null }) => void }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const [from, setFrom] = useState(data.invoice.periodFrom);
  const [to, setTo] = useState(data.invoice.periodTo);
  const [notes, setNotes] = useState(data.invoice.notes ?? "");
  return (
    <Modal open onClose={onClose} title={t("draft.edit")} sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>{t("permissions.cancel")}</Button><Button loading={busy} disabled={busy || !from || !to || to < from} onClick={() => onSave({ periodFrom: from, periodTo: to, notes: notes.trim() || null })}>{t("draft.save")}</Button></>}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Input type="date" lang={LOCALE_TAG[lang]} label={t("wizard.from")} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" lang={LOCALE_TAG[lang]} label={t("wizard.to")} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Textarea label={t("draft.notes")} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}

function AddShiftsDialog({ organizationId, data, busy, onClose, onAdd }: { organizationId: string; data: InvoiceDetail; busy: boolean; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const toast = useToast();
  const [shifts, setShifts] = useState<EligibleShift[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    const token = getToken(); if (!token) return;
    billingDraftsApi.eligible(organizationId, { billingClientId: data.invoice.billingClientId, from: data.invoice.periodFrom, to: data.invoice.periodTo }, token)
      .then((r) => setShifts(r.shifts)).catch((e) => { toast.show(errorText(t, e), "danger"); setShifts([]); });
  }, [organizationId, data.invoice.billingClientId, data.invoice.periodFrom, data.invoice.periodTo, toast, t]);
  const total = (shifts ?? []).filter((s) => selected.has(s.shiftId)).reduce((sum, s) => sum + (s.amountCents ?? 0), 0);
  return (
    <Modal open onClose={onClose} title={t("draft.addShifts")} fullScreenOnMobile
      footer={<div className="flex w-full items-center justify-between gap-2"><span className="text-sm tabular-nums">{t("wizard.selected", { count: selected.size })} · {money(total, lang)}</span>
        <Button loading={busy} disabled={busy || selected.size === 0} onClick={() => onAdd([...selected])}>{t("draft.addShifts")}</Button></div>}>
      {!shifts ? <Skeleton className="h-32" /> : shifts.length === 0 ? <p className="text-sm">{t("wizard.noShifts")}</p>
        : <EligibleShifts shifts={shifts} selected={selected} onToggle={(id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })} />}
    </Modal>
  );
}

function ManualDialog({ organizationId, data, discount, busy, onClose, onAdd }: {
  organizationId: string; data: InvoiceDetail; discount: boolean; busy: boolean; onClose: () => void;
  onAdd: (body: { kind: "manual" | "discount"; description: string; justification: string; serviceId: string | null; careRecipientId: string | null; serviceDate: string; quantityHundredths: number; unitPriceCents: number; taxTreatment: TaxTreatment; taxRateBasisPoints: number | null; taxLegalBasis: string | null }) => void;
}) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const [options, setOptions] = useState<{ client: BillingClientOption | null; services: BillingServiceOption[] } | null>(null);
  const [description, setDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [date, setDate] = useState(data.invoice.periodTo);
  const [recipient, setRecipient] = useState("");
  const [service, setService] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [treatment, setTreatment] = useState<TaxTreatment | "">("");
  const [rate, setRate] = useState("");
  const [basis, setBasis] = useState("");
  useEffect(() => {
    const token = getToken(); if (!token) return;
    billingDraftsApi.clients(organizationId, token).then((r) => setOptions({ client: r.clients.find((c) => c.id === data.invoice.billingClientId) ?? null, services: r.services })).catch(() => setOptions({ client: null, services: [] }));
  }, [organizationId, data.invoice.billingClientId]);
  const q = parseQuantity(qty);
  const p = parseMoney(price);
  const bp = treatment === "taxable" ? parsePercent(rate) : null;
  const amount = Number.isNaN(q) || Number.isNaN(p) ? null : Math.round((q * p) / 100) * (discount ? -1 : 1);
  const serviceWithoutResident = Boolean(service) && !recipient;
  const valid = description.trim().length >= 2 && justification.trim().length >= 3 && date && amount !== null && treatment
    && (treatment !== "taxable" || (bp !== null && !Number.isNaN(bp))) && (treatment !== "exempt" || basis.trim().length >= 3) && !serviceWithoutResident;
  return (
    <Modal open onClose={onClose} title={discount ? t("manual.discountTitle") : t("manual.title")} fullScreenOnMobile
      footer={<div className="flex w-full items-center justify-between gap-2"><span className="text-sm tabular-nums">{t("manual.amount")}: {amount !== null ? money(amount, lang) : "—"}</span>
        <Button loading={busy} disabled={busy || !valid} onClick={() => onAdd({ kind: discount ? "discount" : "manual", description: description.trim(), justification: justification.trim(), serviceId: service || null,
          careRecipientId: recipient || null, serviceDate: date, quantityHundredths: q, unitPriceCents: p, taxTreatment: treatment as TaxTreatment, taxRateBasisPoints: bp, taxLegalBasis: treatment === "exempt" ? basis.trim() : null })}>{t("manual.add")}</Button></div>}>
      {!options ? <Skeleton className="h-40" /> : (
        <div className="flex min-w-0 flex-col gap-3" data-manual-form>
          <Input label={t("manual.description")} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Textarea label={t("manual.justification")} rows={2} maxLength={500} value={justification} onChange={(e) => setJustification(e.target.value)} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <Input type="date" lang={LOCALE_TAG[lang]} label={t("manual.date")} value={date} onChange={(e) => setDate(e.target.value)} />
            <Select label={t("manual.resident")} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">{t("manual.none")}</option>
              {options.client?.recipients.map((r) => <option key={r.id} value={r.id}>{r.name ?? "—"}</option>)}
            </Select>
          </div>
          {!discount && (
            <Select label={t("manual.service")} value={service} onChange={(e) => setService(e.target.value)} error={serviceWithoutResident ? t("manual.serviceNeedsResident") : undefined}>
              <option value="">{t("manual.noService")}</option>
              {options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Input label={t("manual.quantity")} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} error={qty && Number.isNaN(q) ? " " : undefined} />
            <Input label={t("manual.price")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={price && Number.isNaN(p) ? " " : undefined} />
          </div>
          <Select label={t("manual.taxChoice")} value={treatment} onChange={(e) => setTreatment(e.target.value as TaxTreatment | "")}>
            <option value="">—</option>
            <option value="taxable">{t("tax.treatment.taxable")}</option>
            <option value="exempt">{t("tax.treatment.exempt")}</option>
            <option value="pending">{t("tax.treatment.pending")}</option>
          </Select>
          {treatment === "taxable" && <Input label={t("manual.taxRate")} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} error={rate && Number.isNaN(bp ?? NaN) ? " " : undefined} />}
          {treatment === "exempt" && <Input label={t("manual.legalBasis")} maxLength={300} value={basis} onChange={(e) => setBasis(e.target.value)} />}
          <p className="text-xs text-[var(--color-text-muted)]">{t("tax.cpa")}</p>
        </div>
      )}
    </Modal>
  );
}
