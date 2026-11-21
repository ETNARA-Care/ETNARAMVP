import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { getToken } from "@/auth/token";
import { contractErrorMessage, roleTermsApi, saveBlob, type MyRoleTerms, type RoleTermsItem } from "@/api/contracts";
import type { ApiError } from "@/api/client";
import { Button, Checkbox, Modal } from "@/components/ui";

/**
 * 156: términos individuales de la función (Anexo E). Si el servidor tiene el módulo contractual
 * encendido y hay una versión vigente de la función de esta persona que aún no aceptó, se le muestra
 * para leerla, guardarla (PDF) y aceptarla con una casilla que llega desmarcada.
 * No bloquea nada: se puede dejar para más tarde (vuelve a aparecer en la próxima sesión) y ninguna
 * operación depende de aceptarlos. Con el módulo apagado el servidor responde 404 y no se muestra.
 */
export function RoleTermsGate({ organizationId }: { organizationId: string | undefined }) {
  const [data, setData] = useState<MyRoleTerms | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "accept" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [later, setLaterState] = useState(false);

  const load = useCallback(() => {
    const token = getToken();
    if (!organizationId || !token) { setData(null); return; }
    roleTermsApi.mine(organizationId, token).then(setData).catch(() => setData(null));
  }, [organizationId]);
  useEffect(() => { setLaterState(false); load(); }, [load]);

  const pending: RoleTermsItem | undefined = data?.items.find((i) => !i.accepted && i.acceptable);
  // «Más tarde» vale para esta sesión del navegador (vuelve a aparecer en la próxima).
  const laterKey = pending ? `etnara.roleTerms.later.${organizationId}.${pending.id}` : "";
  let laterStored = false;
  try { laterStored = !!laterKey && sessionStorage.getItem(laterKey) === "1"; } catch { /* sin almacenamiento: solo en memoria */ }
  const setLater = (v: boolean) => { setLaterState(v); try { if (v && laterKey) sessionStorage.setItem(laterKey, "1"); } catch { /* ignorar */ } };
  if (!organizationId || !pending || later || laterStored) return null;

  const downloadPdf = async () => {
    const token = getToken(); if (!token) return;
    setBusy("pdf"); setError(null);
    try { saveBlob(await roleTermsApi.pdf(organizationId, pending.id, token), `terminos-${pending.role.toLowerCase()}-v${pending.version_label}.pdf`); }
    catch (e) { setError(contractErrorMessage((e as ApiError).code, (e as ApiError).status)); }
    finally { setBusy(null); }
  };
  const accept = async () => {
    const token = getToken(); if (!token || !checked) return;
    setBusy("accept"); setError(null);
    try { await roleTermsApi.accept(organizationId, pending.id, token, pending.content_sha256); setChecked(false); load(); }
    catch (e) { setError(contractErrorMessage((e as ApiError).code, (e as ApiError).status)); }
    finally { setBusy(null); }
  };

  return (
    <Modal open onClose={() => setLater(true)} title={pending.title} eyebrow={`Versión ${pending.version_label}`} fullScreenOnMobile wide
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setLater(true)} data-testid="role-terms-later">Más tarde</Button>
          <Button onClick={() => void accept()} disabled={!checked} loading={busy === "accept"} data-testid="role-terms-accept">Aceptar</Button>
        </div>
      }>
      <div className="flex flex-col gap-3" data-testid="role-terms-gate">
        <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Antes de usar ETNARA Care, lee los términos que aplican a tu función. Puedes descargarlos para guardarlos.</p>
        <div className="max-h-[50vh] overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-4" tabIndex={0} aria-label="Texto completo de los términos">
          <p className="whitespace-pre-wrap break-words text-[var(--text-small)] leading-relaxed text-[var(--color-text-primary)]" data-testid="role-terms-body">{pending.body}</p>
        </div>
        <p className="break-all text-[var(--text-caption)] text-[var(--color-text-muted)]">Huella SHA-256: <span className="font-mono">{pending.content_sha256}</span></p>
        <div><Button variant="secondary" size="sm" icon={<Download size={16} />} loading={busy === "pdf"} onClick={() => void downloadPdf()} data-testid="role-terms-pdf">Descargar PDF</Button></div>
        <Checkbox label={data?.checkboxText ?? "He leído y acepto los términos individuales de mi función."} checked={checked} onChange={(e) => setChecked(e.target.checked)} data-testid="role-terms-check" />
        {error && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
