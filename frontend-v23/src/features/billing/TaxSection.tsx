import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Scale } from "lucide-react";
import { getToken } from "@/auth/token";
import { billingDraftsApi, type TaxService, type TaxTreatment } from "@/api/billing";
import { Badge, Button, Input, Modal, Select, Skeleton, Textarea, useToast } from "@/components/ui";
import { LOCALE_TAG } from "@/i18n/language";
import { day, errorText, langOf, parsePercent, taxLabel } from "./billingFormat";

/**
 * Tratamiento del IVU por servicio (D5, F2.2). Nothing is preloaded: every
 * service starts «pending» and blocks issuing. Versions by date are only
 * added, never edited. Only the permissions manager can add one.
 */
export function TaxSection({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const [data, setData] = useState<{ today: string; services: TaxService[] } | null>(null);
  const [editing, setEditing] = useState<TaxService | null>(null);
  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setData(await billingDraftsApi.tax(organizationId, token)); } catch { setData({ today: "", services: [] }); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  return (
    <details className="group min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-billing-tax>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-lg"><Scale size={18} aria-hidden />{t("tax.title")}</span>
        <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mt-2 text-sm leading-5 text-[var(--color-text-secondary)]">{t("tax.body")}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("tax.cpa")}{canManage ? "" : ` ${t("tax.onlyManager")}`}</p>
      {!data ? <Skeleton className="mt-3 h-20" /> : (
        <ul className="mt-3 divide-y divide-[var(--color-border)]">
          {data.services.map((s) => (
            <li key={s.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5" data-tax-service={s.id} data-treatment={s.current.treatment}>
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{s.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  <Badge tone={s.current.treatment === "pending" ? "warning" : "success"}>{taxLabel(t, s.current.treatment, s.current.rate_basis_points, lang)}</Badge>
                  {s.current.effective_from ? ` ${t("tax.since", { date: day(s.current.effective_from, lang) })}` : ` ${t("tax.notSet")}`}
                  {s.current.legal_basis ? ` · ${s.current.legal_basis}` : ""}
                </p>
              </div>
              {canManage && <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setEditing(s)}>{t("tax.change")}</Button>}
            </li>
          ))}
        </ul>
      )}
      {editing && data && <TaxDialog organizationId={organizationId} service={editing} today={data.today} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </details>
  );
}

function TaxDialog({ organizationId, service, today, onClose, onSaved }: { organizationId: string; service: TaxService; today: string; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const toast = useToast();
  const [treatment, setTreatment] = useState<TaxTreatment | "">("");
  const [rate, setRate] = useState("");
  const [basis, setBasis] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState(today);
  const [busy, setBusy] = useState(false);
  const bp = parsePercent(rate);
  const valid = treatment && from && (treatment !== "taxable" || !Number.isNaN(bp)) && (treatment !== "exempt" || basis.trim().length >= 3);
  async function save() {
    const token = getToken(); if (!token || !treatment) return;
    setBusy(true);
    try {
      await billingDraftsApi.setTax(organizationId, { serviceId: service.id, treatment, rateBasisPoints: treatment === "taxable" ? bp : null, legalBasis: treatment === "exempt" ? basis.trim() : null, validationNote: note.trim() || null, effectiveFrom: from }, token);
      toast.show(t("tax.saved"), "success"); onSaved();
    } catch (e) { toast.show(errorText(t, e), "danger"); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`${t("tax.title")} · ${service.name}`} sheetOnMobile
      footer={<><Button variant="secondary" onClick={onClose}>{t("permissions.cancel")}</Button><Button loading={busy} disabled={busy || !valid} onClick={() => void save()}>{t("tax.save")}</Button></>}>
      <div className="flex flex-col gap-3">
        <Select label={t("manual.taxChoice")} value={treatment} onChange={(e) => setTreatment(e.target.value as TaxTreatment | "")}>
          <option value="">—</option>
          <option value="taxable">{t("tax.treatment.taxable")}</option>
          <option value="exempt">{t("tax.treatment.exempt")}</option>
          <option value="pending">{t("tax.treatment.pending")}</option>
        </Select>
        {treatment === "taxable" && <Input label={t("tax.rate")} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />}
        {treatment === "exempt" && <Input label={t("tax.legalBasis")} maxLength={300} value={basis} onChange={(e) => setBasis(e.target.value)} />}
        <Input type="date" lang={LOCALE_TAG[lang]} label={t("tax.from")} value={from} onChange={(e) => setFrom(e.target.value)} />
        <Textarea label={t("tax.note")} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-xs text-[var(--color-text-muted)]">{t("tax.cpa")}</p>
        {service.versions.length > 0 && (
          <details className="text-xs"><summary className="cursor-pointer">{t("tax.history", { count: service.versions.length })}</summary>
            <ul className="mt-1 space-y-1 text-[var(--color-text-secondary)]">{service.versions.map((v) => <li key={v.id} className="break-words">{day(v.effective_from, lang)} · {taxLabel(t, v.treatment, v.rate_basis_points, lang)}{v.legal_basis ? ` · ${v.legal_basis}` : ""}{v.created_by_email ? ` · ${v.created_by_email}` : ""}</li>)}</ul>
          </details>
        )}
      </div>
    </Modal>
  );
}
