import { useCallback, useEffect, useState } from "react";
import { FlaskConical, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getToken } from "@/auth/token";
import { checkActivityPhotosLegalHolds, getOrganizationFeatures, setOrganizationFeature, type CentralFeatureCode, type OrganizationFeatures, type PilotFeatureCode, type PlatformOrganizationType, type ResidentialFeatureCode } from "@/api/platformOrganizations";
import { Button, Input, Skeleton, useToast } from "@/components/ui";
import { BillingManagerPanel } from "./BillingManagerPanel";

const ORDER: PilotFeatureCode[] = ["SMARTMATCH", "EN_CAMINO", "FINANZAS", "FACTURACION", "SHIFT_REPORTS", "PUSH_NOTIFICATIONS", "ACTIVITY_PHOTOS", "CONTRACTS"];
/*
 * 170 (hogares F0): interruptores de hogar. El backend solo los envía para un RESIDENTIAL_CARE_HOME (agencias e
 * independientes nunca los reciben) y rechaza encenderlos en otra modalidad. Mostrarlos no los activa: nacen
 * apagados y cada cambio sigue pidiendo motivo y queda en el historial.
 */
const RESIDENTIAL_ORDER: ResidentialFeatureCode[] = ["HOGAR_CALENDARIO", "HOGAR_ASIGNACIONES", "HOGAR_PONCHES", "DEMO_ENVIRONMENT"];
const ALL_ORDER: CentralFeatureCode[] = [...ORDER, ...RESIDENTIAL_ORDER];
/** Solo los interruptores que esta pantalla sabe describir (títulos y detalles en el catálogo «central»). */
const isKnownFeature = (code: string): code is CentralFeatureCode => (ALL_ORDER as string[]).includes(code);

/*
 * F0.1 (25-nov): terminología según la modalidad. Sin tipo (o agencia) el texto es exactamente el de antes.
 */
export type CentralOrganizationKind = "agency" | "home" | "practice";
export function organizationKind(type: PlatformOrganizationType | null | undefined): CentralOrganizationKind {
  return type === "residential_establishment" ? "home" : type === "independent_provider" ? "practice" : "agency";
}

/**
 * ETNARA central: turn the SmartMatch pilot on or off for one agency.
 * The switch only shows the saved state; changing it always goes through the
 * confirmation with a mandatory reason (audited, append-only history).
 */
export function OrganizationFeaturesCard({ organizationId, organizationType }: { organizationId: string; organizationType?: PlatformOrganizationType | null }) {
  const toast = useToast();
  const { t, i18n } = useTranslation("central");
  const kind = organizationKind(organizationType);
  const org = {
    orgThe: t(`org.${kind}.the`), orgThis: t(`org.${kind}.this`), orgThisCap: t(`org.${kind}.thisCap`),
    orgOf: t(`org.${kind}.of`),
  };
  const label = (code: CentralFeatureCode) => ({ title: t(`labels.${code}.title`), detail: t(`labels.${code}.detail`, org) });
  const [data, setData] = useState<OrganizationFeatures | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<{ code: CentralFeatureCode; enabled: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  // 145 (§5): solo se pregunta al abrir el apagado de Fotos (auditado en el backend).
  const [legalHolds, setLegalHolds] = useState<{ org: string; value: boolean } | null>(null);
  useEffect(() => {
    if (!editing || editing.code !== "ACTIVITY_PHOTOS" || editing.enabled) return;
    const token = getToken(); if (!token) return;
    let alive = true;
    checkActivityPhotosLegalHolds(organizationId, token).then((value) => { if (alive) setLegalHolds({ org: organizationId, value }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [editing, organizationId]);

  const load = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try { setData(await getOrganizationFeatures(organizationId, token)); setFailed(false); } catch { setFailed(true); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    const token = getToken(); if (!token || !editing) return;
    setSaving(true);
    try {
      const saved = await setOrganizationFeature(organizationId, editing.code, editing.enabled, reason.trim(), token);
      toast.show(editing.enabled ? t("features.toastActivated") : saved.feature.legalHoldsKept
        ? t("features.toastDeactivatedHolds", org) : t("features.toastDeactivated"), "success");
      setEditing(null); setReason(""); await load();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      toast.show(code === "FEATURE_REQUIRES_FINANZAS" ? t("features.errorRequiresFinanzas") : code === "FEATURE_NOT_AVAILABLE_FOR_MODALITY" ? t("features.errorNotForModality") : t("features.errorSave"), "danger");
    } finally { setSaving(false); }
  }

  // Only switches this screen knows how to describe: a code added by a newer backend
  // is skipped instead of breaking the whole card.
  const features = data ? data.features.filter((f) => isKnownFeature(f.code)).sort((a, b) => ALL_ORDER.indexOf(a.code) - ALL_ORDER.indexOf(b.code)) : [];
  const history = data ? data.history.filter((h) => isKnownFeature(h.code)) : [];
  const activeCount = features.filter((f) => f.enabled).length;
  const finanzasOn = features.some((f) => f.code === "FINANZAS" && f.enabled);
  const facturacionOn = features.some((f) => f.code === "FACTURACION" && f.enabled);

  return (
    <section data-ui="pilot-features" aria-labelledby={`pilot-${organizationId}`}
      className="rounded-[1.25rem] border border-[var(--color-sage-200)] bg-[var(--color-sage-50)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-sage-100)] text-[var(--color-sage-800)]"><FlaskConical size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={`pilot-${organizationId}`} className="font-sans text-[length:1rem] font-semibold leading-tight text-[var(--color-text-primary)]">{t("features.title")}</h3>
            {data && <span className="rounded-full bg-white/80 px-2 py-0.5 text-[length:var(--text-caption)] font-semibold text-[var(--color-text-secondary)]">{t("features.activeCount", { active: activeCount, total: features.length })}</span>}
          </div>
          <p className="mt-1 text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]">{t("features.intro", org)}</p>
        </div>
      </div>

      {failed ? <p className="mt-3 text-[length:var(--text-small)] text-[var(--color-danger-700)]">{t("features.loadFailed")}</p> : !data ? <Skeleton className="mt-4 h-28" /> : (
        <div className="mt-4 space-y-2.5">
          {features.map((f) => {
            const text = label(f.code);
            const pending = editing?.code === f.code;
            // FACTURACION needs FINANZAS (the backend and the database refuse it too).
            const blocked = f.code === "FACTURACION" && !f.enabled && !finanzasOn;
            return (
              <div key={f.code} data-ui="pilot-feature" data-code={f.code} data-state={f.enabled ? "on" : "off"}
                className={`rounded-2xl border bg-white p-3.5 transition-shadow ${pending ? "border-[var(--color-navy-700)] shadow-[0_0_0_3px_rgba(42,58,92,.12)]" : "border-[var(--color-border)]"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-sans text-[length:0.9375rem] font-semibold leading-snug text-[var(--color-text-primary)]">{text.title}</div>
                    <p className="mt-0.5 text-[length:var(--text-small)] leading-5 text-[var(--color-text-secondary)]">{text.detail}</p>
                    <p className={`mt-1.5 inline-flex items-center gap-1.5 text-[length:var(--text-caption)] font-semibold uppercase tracking-[.08em] ${f.enabled ? "text-[var(--color-sage-700)]" : "text-[var(--color-text-muted)]"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${f.enabled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-slate-400)]"}`} aria-hidden />
                      {f.enabled ? t("features.on") : t("features.off")}
                    </p>
                    {blocked && <p className="mt-1 text-[length:var(--text-caption)] text-[var(--color-text-muted)]" data-ui="requires-finanzas">{t("features.requiresFinanzas")}</p>}
                  </div>
                  <button type="button" role="switch" aria-checked={f.enabled} disabled={saving || blocked}
                    aria-label={t("features.switchAria", { title: text.title, state: f.enabled ? t("features.stateOn") : t("features.stateOff"), action: f.enabled ? t("features.deactivate") : t("features.activate") })}
                    onClick={() => { setEditing(pending ? null : { code: f.code, enabled: !f.enabled }); setReason(""); }}
                    className={`relative mt-0.5 inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-offset-2 ${f.enabled ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-ivory-200)] ring-1 ring-inset ring-[var(--color-slate-200)]"} disabled:cursor-not-allowed disabled:opacity-50`}>
                    <span className={`h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgba(15,24,48,.25)] transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>

                {pending && editing && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <p className="text-[length:var(--text-small)] font-semibold text-[var(--color-text-primary)]">
                      {t("features.confirmTitle", { action: editing.enabled ? t("features.activate") : t("features.deactivate"), title: text.title, orgThis: org.orgThis })}
                    </p>
                    {/* 145 (§5): solo un sí/no; nunca cuántas ni cuáles. Apagar nunca se bloquea (emergencias). */}
                    {editing.code === "ACTIVITY_PHOTOS" && !editing.enabled && legalHolds?.org === organizationId && legalHolds.value && (
                      <p className="mt-1 rounded-[var(--radius-md)] bg-[var(--color-warning-100)] px-3 py-2 text-[length:var(--text-caption)] leading-5 text-[var(--color-warning-700)]" data-ui="photos-legal-holds-warning">
                        {t("features.photosLegalHolds", org)}
                      </p>
                    )}
                    {editing.code === "FINANZAS" && !editing.enabled && facturacionOn && (
                      <p className="mt-1 text-[length:var(--text-caption)] leading-5 text-[var(--color-text-secondary)]">{t("features.finanzasOffWithBilling")}</p>
                    )}
                    <div className="mt-2">
                      <Input label={t("features.reason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                      <Button size="sm" variant="secondary" disabled={saving} onClick={() => { setEditing(null); setReason(""); }}>{t("features.cancel")}</Button>
                      <Button size="sm" loading={saving} disabled={saving || reason.trim().length < 3} onClick={() => void save()}>
                        {editing.enabled ? t("features.activate") : t("features.deactivate")}
                      </Button>
                    </div>
                  </div>
                )}
                {f.code === "FACTURACION" && f.enabled && finanzasOn && !pending && <BillingManagerPanel organizationId={organizationId} />}
              </div>
            );
          })}
          {history.length > 0 && (
            <details className="group rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-3 text-[length:var(--text-small)]">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-text-primary)]"><History size={15} />{t("features.history", { count: history.length })}</summary>
              <ul className="mt-2 space-y-1.5">
                {history.map((h, i) => (
                  <li key={i} className="leading-5 text-[var(--color-text-secondary)]">
                    <span className="font-medium text-[var(--color-text-primary)]">{t(h.enabled ? "features.historyActivated" : "features.historyDeactivated", { title: label(h.code).title })}</span> · {new Date(h.occurredAt).toLocaleString(i18n.resolvedLanguage === "en" ? "en-US" : "es-PR")} · {h.reason}{h.actorEmail ? ` · ${h.actorEmail}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
