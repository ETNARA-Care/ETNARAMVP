import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, FileText, MailCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { contractErrorMessage, contractsApi, saveBlob, type AgencyContractAcceptance, type AgencyContractVersion, type SignatureCode } from "@/api/contracts";
import type { ApiError } from "@/api/client";
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, PageHeader, Skeleton } from "@/components/ui";
import { acceptanceLabel, contractDateTime, orderTermsLines, validCode, validFullName, validTitle } from "@/features/contracts/contractFormat";

/**
 * Leer, descargar y firmar una versión (Etapa 2).
 *   1. El documento completo, su versión y su huella; descarga en PDF o texto exacto antes de aceptar.
 *   2. Representante: nombre completo y cargo. Dos casillas DESMARCADAS: aceptación del documento y
 *      declaración expresa de autoridad.
 *   3. Código de 6 dígitos enviado al correo de la cuenta (vence en 10 minutos).
 *   4. Firma y constancia descargable.
 * Cuidadores, familiares y supervisión no ven el formulario (y el servidor los rechaza igualmente).
 */
export function AgencyContractDetailPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const { activeOrganization, roles } = useAuth();
  const organizationId = activeOrganization?.id;
  const isAdmin = roles.includes("ORGANIZATION_ADMIN");
  const [version, setVersion] = useState<AgencyContractVersion | null | "error" | "forbidden" | "missing">(null);
  const [accepted, setAccepted] = useState<AgencyContractAcceptance | null>(null);
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [readAndAccept, setReadAndAccept] = useState(false);
  const [authority, setAuthority] = useState(false);
  const [challenge, setChallenge] = useState<SignatureCode | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"code" | "sign" | "pdf" | "txt" | "cert" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sentAt, setSentAt] = useState(0);
  const [downloaded, setDownloaded] = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!organizationId || !token || !versionId) return;
    setVersion(null);
    try {
      const [v, h] = await Promise.all([contractsApi.version(organizationId, versionId, token), contractsApi.acceptances(organizationId, token)]);
      setVersion(v.version);
      setAccepted(h.acceptances.find((a) => a.document_version_id === versionId) ?? null);
    } catch (e) {
      const s = (e as ApiError).status;
      setVersion(s === 403 ? "forbidden" : s === 404 ? "missing" : "error");
    }
  }, [organizationId, versionId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!challenge) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [challenge]);

  const formValid = validFullName(fullName) && validTitle(title) && readAndAccept && authority;
  const v = typeof version === "object" && version ? version : null;
  const signer = useMemo(() => v ? { signerFullName: fullName.trim(), signerTitle: title.trim(), confirmAuthority: true as const, confirm: true as const, contentSha256: v.content_sha256 } : null, [v, fullName, title]);
  const secondsLeft = challenge ? Math.max(0, Math.round((new Date(challenge.expiresAt).getTime() - now) / 1000)) : 0;
  const resendIn = challenge ? Math.max(0, Math.ceil((sentAt + challenge.resendAfterSeconds * 1000 - now) / 1000)) : 0;

  const download = async (format: "pdf" | "txt") => {
    const token = getToken();
    if (!organizationId || !token || !v) return;
    setBusy(format);
    try { saveBlob(await contractsApi.documentFile(organizationId, v.id, token, format), `${v.code}-v${v.version_label}.${format}`); setDownloaded(true); }
    catch (e) { setError(contractErrorMessage((e as ApiError).code, (e as ApiError).status)); }
    finally { setBusy(null); }
  };
  const requestCode = async () => {
    const token = getToken();
    if (!organizationId || !token || !v || !signer || !formValid) return;
    setBusy("code"); setError(null);
    try { const c = await contractsApi.requestCode(organizationId, v.id, token, signer); setChallenge(c); setCode(""); setSentAt(Date.now()); setNow(Date.now()); }
    catch (e) { setError(contractErrorMessage((e as ApiError).code, (e as ApiError).status)); }
    finally { setBusy(null); }
  };
  const sign = async () => {
    const token = getToken();
    if (!organizationId || !token || !v || !signer || !challenge || !validCode(code)) return;
    setBusy("sign"); setError(null);
    try {
      const r = await contractsApi.accept(organizationId, v.id, token, { ...signer, challengeId: challenge.challengeId, code });
      setAccepted({ ...r.acceptance, version_label: v.version_label, code: v.code, title: v.title, version_status: v.status });
      setChallenge(null);
    } catch (e) {
      const err = e as ApiError;
      setError(contractErrorMessage(err.code, err.status));
      // Código equivocado: se limpia el campo para escribirlo de nuevo; cualquier otro error exige un código nuevo.
      setCode("");
      if (err.code && err.code !== "CONTRACT_CODE_INVALID") setChallenge(null);
    } finally { setBusy(null); }
  };
  const certificate = async () => {
    const token = getToken();
    if (!organizationId || !token || !accepted || !v) return;
    setBusy("cert");
    try { saveBlob(await contractsApi.certificate(organizationId, accepted.id, token), `constancia-${v.code}-v${v.version_label}.pdf`); }
    finally { setBusy(null); }
  };

  const back = <Link to="/agency/contracts" className="inline-flex min-h-11 items-center gap-1.5 text-[var(--text-small)] font-medium text-[var(--color-navy-700)]"><ArrowLeft size={16} /> Contratos</Link>;
  if (!isAdmin || version === "forbidden") {
    return <div className="flex flex-col gap-[var(--spacing-md)]">{back}<Card data-testid="contracts-not-authorized"><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Solo una administradora o administrador activo de la organización puede consultar y firmar los contratos con ETNARA.</p></Card></div>;
  }
  if (version === null) return <div className="flex flex-col gap-[var(--spacing-md)]">{back}<Skeleton className="h-64" /></div>;
  if (version === "error") return <div className="flex flex-col gap-[var(--spacing-md)]">{back}<ErrorState kind="server" onRetry={() => void load()} /></div>;
  if (version === "missing" || !v) return <div className="flex flex-col gap-[var(--spacing-md)]">{back}<EmptyState icon={<FileText size={28} />} title="Documento no disponible" description="Esta versión no existe o todavía no está publicada." /></div>;

  const state = accepted ? acceptanceLabel("accepted") : v.status === "retired" ? { label: "Versión reemplazada", tone: "neutral" as const } : acceptanceLabel("pending");
  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      {back}
      <PageHeader title={v.title} description={`Versión ${v.version_label} · publicada el ${contractDateTime(v.published_at)}`} />
      <div className="flex flex-wrap gap-2"><Badge tone={state.tone}>{state.label}</Badge>{v.is_test && <Badge tone="danger">Documento de prueba</Badge>}</div>

      <Card className="flex flex-col gap-3" data-testid="contract-document">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={16} />} loading={busy === "pdf"} onClick={() => void download("pdf")} data-testid="download-pdf">Descargar PDF</Button>
          <Button variant="ghost" size="sm" icon={<Download size={16} />} loading={busy === "txt"} onClick={() => void download("txt")} data-testid="download-txt">Texto exacto (.txt)</Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-4" tabIndex={0} aria-label="Texto completo del documento">
          <p className="whitespace-pre-wrap break-words text-[var(--text-small)] leading-relaxed text-[var(--color-text-primary)]" data-testid="contract-body">{v.body}</p>
        </div>
        <p className="break-all text-[var(--text-caption)] text-[var(--color-text-muted)]">Huella SHA-256 del texto: <span className="font-mono" data-testid="contract-hash">{v.content_sha256}</span></p>
      </Card>

      {v.kind === "SUBSCRIPTION_ORDER" && v.commercial_terms && (
        <Card className="flex flex-col gap-2" data-testid="order-terms">
          <p className="font-medium">Condiciones de tu Orden de Suscripción</p>
          <ul className="list-disc pl-5 text-[var(--text-small)] text-[var(--color-text-secondary)]">
            {orderTermsLines(v.commercial_terms).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Aceptar esta Orden no activa ningún cobro. Cualquier cargo o renovación requiere tu aceptación expresa por separado.</p>
        </Card>
      )}

      {accepted ? (
        <Card className="flex flex-col gap-3 border-[var(--color-success-700)]/40" data-testid="contract-accepted">
          <p className="flex items-center gap-2 font-medium text-[var(--color-success-700)]"><CheckCircle2 size={20} /> Aceptado electrónicamente</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">El {contractDateTime(accepted.accepted_at)}, por {accepted.signer_full_name} ({accepted.signer_title}), verificado con un código enviado al correo de la cuenta.</p>
          <p className="text-[var(--text-small)] italic text-[var(--color-text-secondary)] [overflow-wrap:anywhere]" data-testid="accepted-statement">{accepted.acceptance_statement}</p>
          <div><Button icon={<Download size={16} />} loading={busy === "cert"} onClick={() => void certificate()} data-testid="download-certificate">Descargar constancia</Button></div>
        </Card>
      ) : v.status === "retired" ? (
        <Card><p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Esta versión fue reemplazada y ya no se puede aceptar. Abre la versión vigente desde Contratos.</p></Card>
      ) : v.signer && !v.signer.allowed ? (
        <Card className="flex flex-col gap-2" data-testid="signer-not-designated">
          <p className="flex items-center gap-2 font-medium"><ShieldAlert size={20} className="text-[var(--color-warning-700)]" /> Tu cuenta no puede firmar este documento</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Administrar la plataforma no equivale, por sí solo, a tener autoridad legal para contratar en nombre de {v.organization_name}. Solo firma la persona que la organización designó ante ETNARA como su representante{v.signer.designation ? "" : " (todavía no hay una designada)"}.</p>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Puedes leer y descargar el documento. Para designar a la representante, escribe a contacto@etnaracare.com.</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4" data-testid="sign-form">
          <p className="flex items-center gap-2 font-medium"><ShieldCheck size={20} className="text-[var(--color-navy-700)]" /> Aceptar en nombre de {v.organization_name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nombre completo de la representante" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={150} required disabled={!!challenge}
              hint="Nombre y apellidos, como en su identificación." error={fullName && !validFullName(fullName) ? "Escribe nombre y apellido." : undefined} data-testid="signer-name" />
            <Input label="Cargo" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="organization-title" maxLength={100} required disabled={!!challenge}
              hint="Por ejemplo: Presidenta, Directora ejecutiva." data-testid="signer-title" />
          </div>
          <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] bg-[var(--color-ivory-100)] p-3">
            <Checkbox label={v.acceptanceCheckboxText ?? "He leído el documento completo y lo acepto en nombre de la organización."} checked={readAndAccept} onChange={(e) => setReadAndAccept(e.target.checked)} disabled={!!challenge} data-testid="check-accept" />
            <Checkbox label={v.authorityDeclaration} checked={authority} onChange={(e) => setAuthority(e.target.checked)} disabled={!!challenge} data-testid="check-authority" />
          </div>
          {!downloaded && <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]" data-testid="download-hint">Te recomendamos descargar el documento (PDF o texto) y guardarlo antes de aceptar.</p>}
          {!challenge ? (
            <div>
              <Button icon={<MailCheck size={18} />} disabled={!formValid} loading={busy === "code"} onClick={() => void requestCode()} data-testid="request-code">Enviar código a mi correo</Button>
              <p className="mt-2 text-[var(--text-caption)] text-[var(--color-text-muted)]">Para confirmar tu identidad te enviaremos un código de 6 dígitos al correo de tu cuenta.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3" data-testid="code-step">
              <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Enviamos un código a <strong data-testid="code-email">{challenge.emailMasked}</strong>. {secondsLeft > 0 ? `Vence en ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}.` : "El código venció; pide uno nuevo."}</p>
              <div className="max-w-xs">
                <Input label="Código de verificación" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" className="font-mono tracking-[0.3em]" data-testid="code-input" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button icon={<CheckCircle2 size={18} />} disabled={!validCode(code) || secondsLeft === 0} loading={busy === "sign"} onClick={() => void sign()} data-testid="sign-button">Firmar y aceptar</Button>
                <Button variant="ghost" disabled={resendIn > 0 || busy !== null} onClick={() => void requestCode()} data-testid="resend-code">{resendIn > 0 ? `Reenviar código (${resendIn} s)` : "Reenviar código"}</Button>
                <Button variant="ghost" disabled={busy !== null} onClick={() => { setChallenge(null); setCode(""); }} data-testid="edit-signer">Corregir datos</Button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]" data-testid="sign-error">{error}</p>}
          <p className="text-[var(--text-caption)] text-[var(--color-text-muted)]">Al firmar se guarda una evidencia que no se puede modificar: el texto exacto (su huella), tu nombre y cargo, la cuenta, la fecha y hora, y la verificación por correo.</p>
        </Card>
      )}
    </div>
  );
}
