import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, CheckCircle2, ImageUp, Lock, ShieldAlert } from "lucide-react";
import { getToken } from "@/auth/token";
import { billingIssueApi, type BillingSettingsInput, type BillingSettingsResponse } from "@/api/billing";
import { Badge, Button, Card, Checkbox, Input, Modal, Skeleton, Textarea, useToast } from "@/components/ui";
import { dateTime, errorText, langOf, tx } from "./billingFormat";

const LOGO_MAX_BYTES = 300 * 1024;
type Form = Required<Pick<BillingSettingsInput, "legalName" | "tradeName" | "address" | "phone" | "email" | "merchantRegistration" | "paymentTerms" | "footerNote">>;
const FIELDS: (keyof Form)[] = ["legalName", "tradeName", "address", "phone", "email", "merchantRegistration", "paymentTerms", "footerNote"];
const LONG: (keyof Form)[] = ["address", "paymentTerms", "footerNote"];

/**
 * Finanzas → Facturación → «Datos de facturación» (F2.3, backend 127). What the
 * PDF shows about the agency, the number prefix, the logo and the agency's own
 * validation of its tax configuration. Only billing.manage edits; everyone with
 * a billing permission sees what still blocks issuing. ETNARA brings no tax
 * rates or exemptions: the agency confirms its configuration with its CPA.
 */
export function BillingSettingsSection({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const { t, i18n } = useTranslation("billing");
  const lang = langOf(i18n.resolvedLanguage);
  const toast = useToast();
  const [data, setData] = useState<BillingSettingsResponse | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [prefix, setPrefix] = useState("");
  const [retention, setRetention] = useState("6");
  const [showCaregiver, setShowCaregiver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [taxDialog, setTaxDialog] = useState<null | boolean>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoRev, setLogoRev] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try {
      const r = await billingIssueApi.settings(organizationId, token);
      setData(r);
      setForm(Object.fromEntries(FIELDS.map((f) => [f, r.settings[f] ?? ""])) as Form);
      setPrefix(r.series.prefix); setRetention(String(r.settings.retentionYears)); setShowCaregiver(r.settings.showCaregiverName);
      setFailed(false);
    } catch (e) {
      // A backend before F2.3 (127) has no /settings route: the section is simply not shown.
      if ((e as { status?: number })?.status === 404) { setUnsupported(true); return; }
      setFailed(true);
    }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  // The logo is read with the session, never from a public link.
  useEffect(() => {
    const token = getToken();
    if (!token || !data?.settings.hasLogo) { setLogoUrl(null); return; }
    let url: string | null = null; let live = true;
    billingIssueApi.logo(organizationId, token).then((b) => { if (live) { url = URL.createObjectURL(b); setLogoUrl(url); } }).catch(() => setLogoUrl(null));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [organizationId, data?.settings.hasLogo, logoRev]);

  if (unsupported) return null;
  if (failed) return <Card><p className="text-sm text-[var(--color-text-secondary)]">{t("loadFailed")}</p><Button size="sm" variant="secondary" className="mt-2" onClick={() => void load()}>{t("retry")}</Button></Card>;
  if (!data || !form) return <Skeleton className="h-40" />;

  const prefixOk = /^[A-Z0-9]{1,6}$/.test(prefix);
  const years = Number(retention);
  const yearsOk = Number.isInteger(years) && years >= 6 && years <= 30;
  const emailOk = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const valid = (form.legalName ?? "").trim().length >= 2 && prefixOk && yearsOk && emailOk;

  async function save() {
    const token = getToken(); if (!token || !form || !data) return;
    setSaving(true);
    try {
      const body: BillingSettingsInput = { ...Object.fromEntries(FIELDS.map((f) => [f, (form[f] ?? "").trim() || null])), showCaregiverName: showCaregiver, retentionYears: years };
      if (!data.series.locked && prefix !== data.series.prefix) body.prefix = prefix;
      await billingIssueApi.updateSettings(organizationId, body, token);
      toast.show(t("settings.saved"), "success");
      await load();
    } catch (e) { toast.show(errorText(t, e), "danger"); }
    finally { setSaving(false); }
  }

  async function uploadLogo(file: File) {
    const token = getToken(); if (!token) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { toast.show(t("errors.LOGO_TYPE_NOT_ALLOWED"), "danger"); return; }
    if (file.size > LOGO_MAX_BYTES) { toast.show(t("errors.LOGO_TOO_LARGE"), "danger"); return; }
    setSaving(true);
    try { await billingIssueApi.uploadLogo(organizationId, file, token); toast.show(t("settings.logoSaved"), "success"); await load(); setLogoRev((r) => r + 1); }
    catch (e) { toast.show(errorText(t, e), "danger"); }
    finally { setSaving(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const s = data.settings;
  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="billing-settings-title" data-billing-settings>
      <div className="min-w-0">
        <h2 id="billing-settings-title" className="flex items-center gap-2 font-display text-lg"><Building2 size={18} aria-hidden />{t("settings.title")}</h2>
        <p className="text-sm leading-5 text-[var(--color-text-secondary)]">{t("settings.body")}</p>
      </div>

      {data.blockers.length > 0 ? (
        <div className="flex min-w-0 items-start gap-2 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm" data-settings-blockers>
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
          <div className="min-w-0"><p className="font-semibold">{t("settings.blockedTitle")}</p>
            <ul className="mt-1 list-disc pl-5 text-[var(--color-text-secondary)]">{data.blockers.map((b) => <li key={b} data-blocker={b}>{tx(t, `blockers.${b}`, "draft.blockersTitle")}</li>)}</ul></div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-[var(--color-sage-800)]" data-settings-ready><CheckCircle2 size={16} aria-hidden />{t("settings.ready")}</p>
      )}

      <Card className="flex min-w-0 flex-col gap-3" data-settings-tax>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{t("settings.taxTitle")}</p>
          <Badge tone={s.taxValidatedAt ? "success" : "warning"}>{s.taxValidatedAt ? t("settings.taxValidated") : t("settings.taxNotValidated")}</Badge>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("settings.taxBody")}</p>
        {s.taxValidatedAt && <p className="break-words text-xs text-[var(--color-text-muted)]">{t("settings.taxValidatedLine", { when: dateTime(s.taxValidatedAt, lang), email: s.taxValidatedBy ?? "—" })}{s.taxValidationNote ? ` · ${s.taxValidationNote}` : ""}</p>}
        {canManage && (
          <Button size="sm" variant={s.taxValidatedAt ? "ghost" : "secondary"} className="self-start" onClick={() => setTaxDialog(!s.taxValidatedAt)} data-tax-validate>
            {s.taxValidatedAt ? t("settings.taxWithdraw") : t("settings.taxValidate")}
          </Button>
        )}
      </Card>

      <Card className="flex min-w-0 flex-col gap-3" data-settings-profile>
        <p className="font-semibold">{t("settings.profileTitle")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          {FIELDS.filter((f) => !LONG.includes(f)).map((f) => (
            <Input key={f} label={t(`settings.fields.${f}`)} value={form[f] ?? ""} disabled={!canManage} maxLength={f === "phone" ? 40 : f === "merchantRegistration" ? 60 : 200}
              inputMode={f === "phone" ? "tel" : f === "email" ? "email" : undefined} error={f === "email" && !emailOk ? t("settings.emailInvalid") : undefined}
              onChange={(e) => set(f, e.target.value)} data-field={f} />
          ))}
        </div>
        {LONG.map((f) => (
          <Textarea key={f} label={t(`settings.fields.${f}`)} rows={2} value={form[f] ?? ""} disabled={!canManage} maxLength={f === "address" ? 400 : f === "paymentTerms" ? 300 : 500} onChange={(e) => set(f, e.target.value)} data-field={f} />
        ))}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <div className="min-w-0">
            <Input label={t("settings.prefix")} value={prefix} disabled={!canManage || data.series.locked} maxLength={6} autoCapitalize="characters"
              onChange={(e) => setPrefix(e.target.value.toUpperCase())} error={!prefixOk ? t("settings.prefixInvalid") : undefined} data-field="prefix" />
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              {data.series.locked && <Lock size={12} aria-hidden />}{data.series.locked ? t("settings.prefixLocked") : t("settings.nextNumber", { number: `${prefix || data.series.prefix}-${String(data.series.nextNumber).padStart(6, "0")}` })}
            </p>
          </div>
          <Input label={t("settings.retention")} inputMode="numeric" value={retention} disabled={!canManage} onChange={(e) => setRetention(e.target.value.replace(/\D/g, ""))}
            error={!yearsOk ? t("settings.retentionInvalid") : undefined} hint={t("settings.retentionHint")} data-field="retentionYears" />
        </div>
        <Checkbox label={t("settings.showCaregiver")} checked={showCaregiver} disabled={!canManage} onChange={(e) => setShowCaregiver(e.target.checked)} data-field="showCaregiverName" />
        <p className="-mt-2 pl-7 text-xs text-[var(--color-text-muted)]">{t("settings.showCaregiverHint")}</p>

        <div className="flex min-w-0 flex-wrap items-center gap-3" data-settings-logo>
          <div className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-ivory-50)]">
            {logoUrl ? <img src={logoUrl} alt={t("settings.logoAlt")} className="max-h-full max-w-full object-contain" /> : <span className="px-2 text-center text-xs text-[var(--color-text-muted)]">{t("settings.noLogo")}</span>}
          </div>
          {canManage && (
            <div className="min-w-0">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" id="billing-logo-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
              <Button size="sm" variant="secondary" icon={<ImageUp size={15} />} disabled={saving} onClick={() => fileRef.current?.click()}>{s.hasLogo ? t("settings.logoReplace") : t("settings.logoUpload")}</Button>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("settings.logoHint")}</p>
            </div>
          )}
        </div>

        {canManage && <Button className="self-start" loading={saving} disabled={saving || !valid} onClick={() => void save()} data-settings-save>{t("draft.save")}</Button>}
      </Card>

      {taxDialog !== null && (
        <TaxValidationDialog validate={taxDialog} busy={saving} onClose={() => setTaxDialog(null)} onConfirm={async (note) => {
          const token = getToken(); if (!token) return;
          setSaving(true);
          try { await billingIssueApi.taxValidation(organizationId, { validated: taxDialog, note }, token); toast.show(taxDialog ? t("settings.taxValidatedOk") : t("settings.taxWithdrawnOk"), "success"); setTaxDialog(null); await load(); }
          catch (e) { toast.show(errorText(t, e), "danger"); }
          finally { setSaving(false); }
        }} />
      )}
    </section>
  );
}

function TaxValidationDialog({ validate, busy, onClose, onConfirm }: { validate: boolean; busy: boolean; onClose: () => void; onConfirm: (note: string) => void }) {
  const { t } = useTranslation("billing");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const ok = note.trim().length >= 3 && (!validate || confirmed);
  return (
    <Modal open onClose={onClose} sheetOnMobile title={validate ? t("settings.taxValidateTitle") : t("settings.taxWithdrawTitle")}
      footer={<><Button variant="secondary" onClick={onClose}>{t("permissions.cancel")}</Button><Button variant={validate ? "primary" : "danger"} loading={busy} disabled={busy || !ok} onClick={() => onConfirm(note.trim())} data-tax-confirm>{validate ? t("settings.taxValidate") : t("settings.taxWithdraw")}</Button></>}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-[var(--color-text-secondary)]">{validate ? t("settings.taxValidateBody") : t("settings.taxWithdrawBody")}</p>
        {validate && <Checkbox label={t("settings.taxValidateCheck")} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
        <Textarea label={t("settings.taxNote")} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
