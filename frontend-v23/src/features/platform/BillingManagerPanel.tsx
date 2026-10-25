import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { getToken } from "@/auth/token";
import { designateBillingManager, getBillingAdmins, type BillingAdminsForCentral } from "@/api/platformOrganizations";
import { Button, Input, Select, Skeleton, useToast } from "@/components/ui";

/**
 * ETNARA central, inside the FACTURACION switch (F2.1): who manages billing
 * permissions at this agency, and designating one administrator as manager.
 * Central only ever receives e-mails and the manager flag — never invoices,
 * rates or amounts (backend 123: SECURITY DEFINER functions, no money).
 */
export function BillingManagerPanel({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("billing");
  const toast = useToast();
  const [data, setData] = useState<BillingAdminsForCentral | null>(null);
  const [failed, setFailed] = useState(false);
  const [membershipId, setMembershipId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setData(await getBillingAdmins(organizationId, token)); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function designate() {
    const token = getToken(); if (!token || !membershipId) return;
    setSaving(true);
    try {
      const r = await designateBillingManager(organizationId, membershipId, reason.trim(), token);
      toast.show(r.designation.granted > 0 ? t("central.done") : t("central.already"), "success");
      setMembershipId(""); setReason(""); await load();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      toast.show(code === "BILLING_PERMISSION_ADMIN_ONLY" ? t("errors.BILLING_PERMISSION_ADMIN_ONLY") : t("errors.generic"), "danger");
    } finally { setSaving(false); }
  }

  if (failed) return <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-danger-700)]">{t("central.loadFailed")}</p>;
  if (!data) return <Skeleton className="mt-3 h-20" />;
  const managers = data.admins.filter((a) => a.isManager);

  return (
    <div className="mt-3 min-w-0 border-t border-[var(--color-border)] pt-3" data-ui="billing-manager">
      <p className="flex items-center gap-1.5 text-[length:var(--text-small)] font-semibold text-[var(--color-text-primary)]"><KeyRound size={15} aria-hidden />{t("central.title")}</p>
      <p className="mt-0.5 text-[length:var(--text-caption)] leading-5 text-[var(--color-text-secondary)]">{t("central.body")}</p>
      {data.admins.length === 0 ? (
        <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-text-secondary)]">{t("central.noAdmins")}</p>
      ) : (
        <>
          <p className="mt-2 text-[length:var(--text-caption)] font-semibold uppercase tracking-[.08em] text-[var(--color-text-muted)]">{t("central.current")}</p>
          {managers.length === 0
            ? <p className="text-[length:var(--text-small)] text-[var(--color-text-secondary)]" data-ui="billing-manager-none">{t("central.noneYet")}</p>
            : <ul className="mt-0.5 space-y-0.5" data-ui="billing-manager-list">{managers.map((m) => <li key={m.membershipId} className="break-all text-[length:var(--text-small)] font-medium text-[var(--color-text-primary)]">{m.email}</li>)}</ul>}
          <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 [&>*]:min-w-0">
            <Select label={t("central.candidate")} value={membershipId} onChange={(e) => setMembershipId(e.target.value)}>
              <option value="">{t("central.choose")}</option>
              {data.admins.filter((a) => !a.isManager).map((a) => <option key={a.membershipId} value={a.membershipId}>{a.email}</option>)}
            </Select>
            <Input label={t("central.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={saving} disabled={saving || !membershipId || reason.trim().length < 3} onClick={() => void designate()}>{t("central.designate")}</Button>
          </div>
        </>
      )}
    </div>
  );
}
