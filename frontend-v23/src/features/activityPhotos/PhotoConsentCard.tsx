import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, FileText, ShieldCheck } from "lucide-react";
import { getToken } from "@/auth/token";
import {
  getPhotoConsentForm, listPhotoConsents, recordPhotoConsent, revokePhotoConsent,
  type PhotoConsent, type PhotoConsentSigner, type PhotoConsentType,
} from "@/api/activityPhotos";
import { Badge, BottomSheet, Button, Card, Select, Textarea, useToast } from "@/components/ui";
import { currentLanguage } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { agencyPhotoErrorKey } from "./photoErrors";

const TYPES: PhotoConsentType[] = ["PHOTO_CAPTURE", "PHOTO_SHARE_FAMILY"];
const SIGNERS: PhotoConsentSigner[] = ["LEGAL_REPRESENTATIVE", "PATIENT"];
const FORM_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Consentimientos de fotografía de un residente (E2). Solo administración y
 * supervisión (el padre decide si se muestra; el backend lo vuelve a comprobar).
 * Un consentimiento nunca se edita ni se borra: se revoca y se registra otro.
 * El formulario firmado se abre como Blob privado, sin enlace al almacenamiento.
 */
export function PhotoConsentCard({ organizationId, careRecipientId }: { organizationId: string; careRecipientId: string }) {
  const { t } = useTranslation("photos");
  const { show } = useToast();
  const language = currentLanguage();
  const [consents, setConsents] = useState<PhotoConsent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [type, setType] = useState<PhotoConsentType>("PHOTO_CAPTURE");
  const [signer, setSigner] = useState<PhotoConsentSigner>("LEGAL_REPRESENTATIVE");
  const [form, setForm] = useState<File | null>(null);
  const [revoking, setRevoking] = useState<PhotoConsent | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setConsents(await listPhotoConsents(organizationId, careRecipientId, token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [organizationId, careRecipientId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const date = (value: string) => formatDate(value, language, { day: "numeric", month: "short", year: "numeric" });

  function openRecord(next: PhotoConsentType) {
    setType(next);
    setSigner("LEGAL_REPRESENTATIVE");
    setForm(null);
    setRecordOpen(true);
  }

  async function saveConsent() {
    const token = getToken();
    if (!token || !form) return;
    setBusy(true);
    try {
      const contentType = FORM_TYPES.includes(form.type) ? form.type : /\.pdf$/i.test(form.name) ? "application/pdf" : "application/octet-stream";
      await recordPhotoConsent(organizationId, careRecipientId, type, signer, form, contentType, token);
      show(t("consents.recorded"), "success");
      setRecordOpen(false);
      setForm(null);
      await load();
    } catch (error) {
      const { key, code } = agencyPhotoErrorKey(error);
      show(t(key, { code }), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevoke() {
    const token = getToken();
    if (!token || !revoking || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await revokePhotoConsent(organizationId, revoking.id, reason, token);
      show(t("consents.revoked_ok"), "success");
      setRevoking(null);
      setReason("");
      await load();
    } catch (error) {
      const { key, code } = agencyPhotoErrorKey(error);
      show(t(key, { code }), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function viewForm(consent: PhotoConsent) {
    const token = getToken();
    if (!token) return;
    // La pestaña se abre antes de la espera para que Safari (iPhone) no la bloquee.
    const tab = window.open("", "_blank");
    try {
      const blob = await getPhotoConsentForm(organizationId, consent.id, token);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url; else window.location.assign(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      const { key, code } = agencyPhotoErrorKey(error);
      show(t(key, { code }), "danger");
    }
  }

  return (
    <Card data-testid="photo-consent-card">
      <div className="mb-2 flex items-center gap-2"><ShieldCheck size={21} aria-hidden /><h2 className="font-medium text-[var(--color-text-primary)]">{t("consents.title")}</h2></div>
      <p className="mb-4 text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("consents.description")}</p>
      {failed && <p className="text-[var(--text-small)] text-[var(--color-danger-700)]" role="alert">{t("consents.loadFailed")}</p>}
      {!failed && consents && (
        <div className="flex flex-col gap-3">
          {TYPES.map((consentType) => {
            const rows = consents.filter((c) => c.type === consentType);
            const current = rows.find((c) => c.active) ?? null;
            const previous = rows.filter((c) => c !== current);
            return (
              <div key={consentType} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3" data-testid={`consent-${consentType}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-[var(--text-small)] text-[var(--color-text-primary)]">{t(`consents.type.${consentType}`)}</p>
                  <Badge tone={current ? "success" : "warning"}>{current ? t("consents.active") : t("consents.none")}</Badge>
                </div>
                {current && (
                  <div className="mt-2 flex flex-col gap-1 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
                    <p>{t(`consents.signer.${current.signerRole}`)}</p>
                    <p>{t("consents.grantedOn", { date: date(current.grantedAt), by: current.grantedBy ? t("consents.grantedBy", { actor: current.grantedBy }) : "" })}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {current
                    ? <>
                      <Button size="sm" variant="secondary" icon={<FileText size={16} />} onClick={() => void viewForm(current)} data-testid="consent-view-form">{t("consents.viewForm")}</Button>
                      <Button size="sm" variant="danger" onClick={() => { setReason(""); setRevoking(current); }} data-testid="consent-revoke">{t("consents.revoke")}</Button>
                    </>
                    : <Button size="sm" onClick={() => openRecord(consentType)} data-testid="consent-record">{t("consents.record")}</Button>}
                </div>
                {previous.length > 0 && (
                  <details className="mt-3 text-[var(--text-caption)] text-[var(--color-text-muted)]">
                    <summary className="min-h-11 cursor-pointer py-2 font-medium">{t("consents.history")} ({previous.length})</summary>
                    <ul className="flex flex-col gap-2" data-testid="consent-previous">
                      {previous.map((c) => (
                        <li key={c.id}>
                          <span>v{c.version} · {t(`consents.signer.${c.signerRole}`)} · {t("consents.grantedOn", { date: date(c.grantedAt), by: "" })}</span>
                          {c.revokedAt && <span> · {t("consents.revokedOn", { date: date(c.revokedAt), by: c.revokedBy ? t("consents.grantedBy", { actor: c.revokedBy }) : "" })}</span>}
                          {c.revocationReason && <span> · {t("consents.revokedReason", { reason: c.revocationReason })}</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BottomSheet open={recordOpen} onClose={() => !busy && setRecordOpen(false)} title={t("consents.recordTitle")}
        footer={<><Button variant="secondary" fullWidth disabled={busy} onClick={() => setRecordOpen(false)}>{t("review.cancel")}</Button><Button fullWidth loading={busy} disabled={!form} onClick={() => void saveConsent()} data-testid="consent-save">{t("consents.save")}</Button></>}>
        <div className="flex flex-col gap-3" data-testid="consent-record-sheet">
          <Select label={t("consents.typeLabel")} value={type} onChange={(event) => setType(event.target.value as PhotoConsentType)} data-testid="consent-type">
            {TYPES.map((item) => <option key={item} value={item}>{t(`consents.type.${item}`)}</option>)}
          </Select>
          <Select label={t("consents.signerLabel")} value={signer} onChange={(event) => setSigner(event.target.value as PhotoConsentSigner)} data-testid="consent-signer">
            {SIGNERS.map((item) => <option key={item} value={item}>{t(`consents.signer.${item}`)}</option>)}
          </Select>
          <div className="flex flex-col gap-2">
            <p className="text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">{t("consents.formLabel")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<Camera size={16} />} onClick={() => cameraInput.current?.click()}>{t("consents.takeFormPhoto")}</Button>
              <Button variant="secondary" icon={<FileText size={16} />} onClick={() => fileInput.current?.click()}>{t("consents.chooseForm")}</Button>
            </div>
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" data-testid="consent-form-camera" onChange={(event) => { setForm(event.target.files?.[0] ?? null); event.target.value = ""; }} />
            <input ref={fileInput} type="file" accept="application/pdf,image/*" className="hidden" data-testid="consent-form-file" onChange={(event) => { setForm(event.target.files?.[0] ?? null); event.target.value = ""; }} />
            {form && <p className="text-[var(--text-caption)] text-[var(--color-sage-700)]" data-testid="consent-form-chosen">{t("consents.formChosen", { name: form.name })}</p>}
            <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("consents.formHint")}</p>
          </div>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">{t("consents.recordNote")}</p>
        </div>
      </BottomSheet>

      <BottomSheet open={!!revoking} onClose={() => !busy && setRevoking(null)} title={t("consents.revokeTitle")}
        footer={<><Button variant="secondary" fullWidth disabled={busy} onClick={() => setRevoking(null)}>{t("review.cancel")}</Button><Button variant="danger" fullWidth loading={busy} disabled={reason.trim().length < 3} onClick={() => void confirmRevoke()} data-testid="consent-revoke-confirm">{t("consents.revoke")}</Button></>}>
        <div className="flex flex-col gap-3">
          {revoking && <p className="font-medium text-[var(--text-small)] text-[var(--color-text-primary)]">{t(`consents.type.${revoking.type}`)}</p>}
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">{t("consents.revokeWarning")}</p>
          <Textarea label={t("review.reasonLabel")} value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} data-testid="consent-revoke-reason" />
        </div>
      </BottomSheet>
    </Card>
  );
}
