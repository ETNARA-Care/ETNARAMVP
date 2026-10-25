import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Eye, FileText, History, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { getToken } from "@/auth/token";
import { BILLING_CAPABILITIES, billingApi, type BillingAccess, type BillingAdmin, type BillingCapability, type BillingGrant, type BillingPermissions } from "@/api/billing";
import { Badge, Button, Card, Modal, Skeleton, Textarea, useToast } from "@/components/ui";
import { formatDate, formatTime } from "@/i18n/format";
import { BillingSettingsSection } from "./BillingSettingsSection";
import { InvoicesSection } from "./InvoicesSection";
import { TaxSection } from "./TaxSection";

type Lang = "es" | "en";
const KNOWN_ERRORS = ["LAST_PERMISSION_MANAGER", "BILLING_PERMISSION_EXISTS", "BILLING_PERMISSION_ADMIN_ONLY", "BILLING_PERMISSION_ALREADY_REVOKED",
  "BILLING_READ_ONLY", "FEATURE_NOT_ENABLED", "BILLING_FORBIDDEN", "BILLING_CONCURRENT_CHANGE"] as const;

/**
 * Finanzas → Facturación (F2.1, backend 123). What each administrator sees
 * depends on the module state and on their OWN billing permissions, which the
 * backend and the database enforce (this screen only hides what they would
 * refuse). FACTURACION off and never used: a discreet premium notice, no price.
 * Turned off after use: view-only banner, history kept.
 */
export function BillingTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("billing");
  const [access, setAccess] = useState<BillingAccess | null>(null);
  const [perms, setPerms] = useState<BillingPermissions | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try {
      const a = await billingApi.access(organizationId, token);
      setAccess(a);
      setPerms(a.capabilities.includes("view") ? await billingApi.permissions(organizationId, token) : null);
      setFailed(false);
    } catch (e) {
      // A backend without Facturación (before 123) has no /billing route: show the module as off.
      if ((e as { status?: number })?.status === 404) { setAccess({ module: { finanzas: true, facturacion: false, enabled: false, readOnly: true }, capabilities: [] }); setPerms(null); setFailed(false); return; }
      setFailed(true);
    }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  if (failed) {
    return (
      <Card className="flex flex-col items-start gap-3" data-billing="failed">
        <p className="text-sm text-[var(--color-text-secondary)]">{t("loadFailed")}</p>
        <Button size="sm" variant="secondary" onClick={() => void load()}>{t("retry")}</Button>
      </Card>
    );
  }
  if (!access) return <Skeleton className="h-40" />;

  const { module, capabilities } = access;
  if (!module.enabled && !capabilities.includes("view")) return <PremiumNotice />;

  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-md)]" data-billing={module.enabled ? "active" : "read-only"}>
      {module.readOnly && (
        <div role="status" data-billing-readonly className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-ivory-100)] p-3.5">
          <Eye size={18} className="mt-0.5 shrink-0 text-[var(--color-navy-700)]" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">{t("readOnly.title")}</p>
            <p className="text-sm leading-5 text-[var(--color-text-secondary)]">{t("readOnly.body")}</p>
          </div>
        </div>
      )}

      <Card className="flex min-w-0 flex-col gap-3">
        <p className="text-sm leading-5 text-[var(--color-text-secondary)]">{t("intro")}</p>
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t("myCapabilities")}</p>
          {capabilities.length === 0
            ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]" data-billing-no-permission>{t("noPermission")}</p>
            : <ul className="mt-1.5 flex flex-wrap gap-1.5" data-billing-my-caps>{capabilities.map((c) => <li key={c}><Badge tone="success">{t(`caps.${c}`)}</Badge></li>)}</ul>}
        </div>
        {module.enabled && capabilities.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><FileText size={16} className="shrink-0" aria-hidden />{t("nextStage")}</p>
        )}
      </Card>

      {capabilities.length > 0 && (
        <InvoicesSection organizationId={organizationId} canDraft={capabilities.includes("draft")} canManageTax={capabilities.includes("manage")} canIssue={capabilities.includes("issue")} readOnly={module.readOnly} />
      )}
      {capabilities.length > 0 && <BillingSettingsSection organizationId={organizationId} canManage={capabilities.includes("manage") && module.enabled} />}
      {(capabilities.includes("view") || capabilities.includes("draft") || capabilities.includes("manage")) && (
        <TaxSection organizationId={organizationId} canManage={capabilities.includes("manage") && module.enabled} />
      )}
      {perms && <PermissionsSection organizationId={organizationId} data={perms} onChanged={load} />}
    </div>
  );
}

function PremiumNotice() {
  const { t } = useTranslation("billing");
  return (
    <Card className="flex min-w-0 items-start gap-3.5" data-billing="premium">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sage-100)] text-[var(--color-sage-800)]"><Sparkles size={19} aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[.08em] text-[var(--color-sage-700)]">{t("premium.eyebrow")}</p>
        <h2 className="font-display text-lg leading-snug text-[var(--color-text-primary)]">{t("premium.title")}</h2>
        <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">{t("premium.body")}</p>
        <p className="mt-2 text-sm leading-5 text-[var(--color-text-muted)]">{t("premium.how")}</p>
      </div>
    </Card>
  );
}

type Pending = { kind: "grant"; admin: BillingAdmin; capability: BillingCapability } | { kind: "revoke"; admin: BillingAdmin; capability: BillingCapability; grantId: string };

function PermissionsSection({ organizationId, data, onChanged }: { organizationId: string; data: BillingPermissions; onChanged: () => Promise<void> }) {
  const { t, i18n } = useTranslation("billing");
  const lang: Lang = i18n.resolvedLanguage === "en" ? "en" : "es";
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = data.canManage && data.module.enabled;
  const live = (membershipId: string, capability: BillingCapability) =>
    data.history.find((g) => g.membership_id === membershipId && g.capability === capability && !g.revoked_at);
  const emailOf = (membershipId: string) => data.admins.find((a) => a.membershipId === membershipId)?.email ?? "—";
  const when = (iso: string) => `${formatDate(iso, lang, { day: "numeric", month: "short", year: "numeric" })} ${formatTime(iso, lang)}`;

  async function confirm() {
    const token = getToken(); if (!token || !pending) return;
    setSaving(true);
    try {
      if (pending.kind === "grant") await billingApi.grant(organizationId, { membershipId: pending.admin.membershipId, capability: pending.capability, reason: reason.trim() }, token);
      else await billingApi.revoke(organizationId, pending.grantId, reason.trim(), token);
      toast.show(pending.kind === "grant" ? t("permissions.granted") : t("permissions.revoked"), "success");
      setPending(null); setReason("");
      await onChanged();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      toast.show(code && (KNOWN_ERRORS as readonly string[]).includes(code) ? t(`errors.${code as (typeof KNOWN_ERRORS)[number]}`) : t("errors.generic"), "danger");
    } finally { setSaving(false); }
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="billing-permissions-title" data-billing-permissions>
      <div className="min-w-0">
        <h2 id="billing-permissions-title" className="flex items-center gap-2 font-display text-lg"><ShieldCheck size={18} aria-hidden />{t("permissions.title")}</h2>
        <p className="text-sm leading-5 text-[var(--color-text-secondary)]">{t("permissions.body")}</p>
        {canEdit && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t("permissions.lastManagerHint")}</p>}
      </div>

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 [&>li]:min-w-0">
        {data.admins.map((admin) => (
          <li key={admin.membershipId}>
            <Card className="flex min-w-0 flex-col gap-2" data-billing-admin>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 break-all font-medium leading-snug text-[var(--color-text-primary)]">{admin.email}</p>
                {admin.isMe && <Badge tone="neutral">{t("you")}</Badge>}
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {BILLING_CAPABILITIES.map((capability) => {
                  const grant = live(admin.membershipId, capability);
                  return (
                    <li key={capability} className="flex min-w-0 items-center justify-between gap-3 py-2" data-cap={capability} data-state={grant ? "on" : "off"}>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                          {grant ? <Check size={15} className="shrink-0 text-[var(--color-sage-700)]" aria-hidden /> : <Lock size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden />}
                          {t(`caps.${capability}`)}
                        </p>
                        <p className="text-xs leading-4 text-[var(--color-text-muted)]">{t(`capsDetail.${capability}`)}</p>
                      </div>
                      {canEdit && (grant
                        ? <Button size="sm" variant="ghost" className="shrink-0" onClick={() => { setPending({ kind: "revoke", admin, capability, grantId: grant.id }); setReason(""); }}>{t("permissions.revoke")}</Button>
                        : <Button size="sm" variant="secondary" className="shrink-0" onClick={() => { setPending({ kind: "grant", admin, capability }); setReason(""); }}>{t("permissions.grant")}</Button>)}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      {data.history.length > 0 && (
        <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm" data-billing-history>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><History size={15} aria-hidden />{t("permissions.history", { count: data.history.length })}</summary>
          <ul className="mt-2 space-y-2">
            {data.history.map((g: BillingGrant) => (
              <li key={g.id} className="min-w-0 break-words leading-5 text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">{t("permissions.grantedLine", { capability: t(`caps.${g.capability}`), email: emailOf(g.membership_id), when: when(g.granted_at) })}</span>
                {" · "}{t(`permissions.source.${g.grant_source}`)}{g.granted_by_email ? ` ${t("permissions.by", { email: g.granted_by_email })}` : ""} · {g.grant_reason}
                {g.revoked_at && <><br />{t("permissions.revokedLine", { when: when(g.revoked_at) })}{g.revoked_by_email ? ` ${t("permissions.by", { email: g.revoked_by_email })}` : ""}{g.revoke_reason ? ` · ${g.revoke_reason}` : ""}</>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {pending && (
        <Modal open sheetOnMobile onClose={() => setPending(null)}
          title={t(pending.kind === "grant" ? "permissions.grantTitle" : "permissions.revokeTitle", { capability: t(`caps.${pending.capability}`) })}
          footer={<>
            <Button variant="secondary" onClick={() => setPending(null)}>{t("permissions.cancel")}</Button>
            <Button variant={pending.kind === "revoke" ? "danger" : "primary"} loading={saving} disabled={saving || reason.trim().length < 3} onClick={() => void confirm()}>
              {pending.kind === "grant" ? t("permissions.grant") : t("permissions.revoke")}
            </Button>
          </>}>
          <div className="flex flex-col gap-3">
            <p className="break-all text-sm text-[var(--color-text-secondary)]">{t(pending.kind === "grant" ? "permissions.to" : "permissions.from", { email: pending.admin.email })}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{t(`capsDetail.${pending.capability}`)}</p>
            <Textarea label={t("permissions.reason")} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </Modal>
      )}
    </section>
  );
}
