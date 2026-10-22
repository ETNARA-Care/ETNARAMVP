import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  acceptOrganizationAdminInvitation,
  activateOrganizationAdminInvitation,
  inspectOrganizationAdminInvitation,
  type OrganizationAdminInvitationInspection,
} from "@/api/platformOrganizations";
import type { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import { Button, Card, Input, Skeleton } from "@/components/ui";

/**
 * Invitación de equipo (administrador o supervisor).
 * - Cuenta nueva: crea la contraseña (como antes).
 * - Cuenta existente (fase 12.3): inicia sesión aquí mismo y acepta; el
 *   backend comprueba que el correo invitado sea el de esa cuenta.
 */
export function OrganizationAdminInvitationPage() {
  const navigate = useNavigate();
  const { status, user, login, refreshSession } = useAuth();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [invitation, setInvitation] = useState<OrganizationAdminInvitationInspection | null | undefined>(token ? undefined : null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"created" | "accepted" | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "El enlace de invitación no es válido.");

  useEffect(() => {
    if (!token) return;
    inspectOrganizationAdminInvitation(token)
      .then(setInvitation)
      .catch(() => { setInvitation(null); setError("Esta invitación venció, ya fue utilizada o fue revocada."); });
  }, [token]);

  const supervisor = invitation?.target_name?.startsWith("Supervisor") ?? false;
  const who = supervisor ? "supervisor" : "administrador";

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    setError(null);
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    setSubmitting(true);
    try {
      await activateOrganizationAdminInvitation(token, password);
      setDone("created");
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      setError("No pudimos activar la cuenta. Solicita una invitación nueva si este enlace ya fue utilizado o venció.");
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptWithExistingAccount(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    setError(null);
    setSubmitting(true);
    try {
      if (status !== "authenticated") await login(email.trim(), password);
      const session = getToken();
      if (!session) throw new Error("NO_SESSION");
      await acceptOrganizationAdminInvitation(token, session);
      await refreshSession();
      setDone("accepted");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (requestError) {
      const code = (requestError as ApiError).code;
      if (code === "INVITATION_IDENTITY_MISMATCH") setError(`Esta invitación es para ${invitation.email_masked}. Entra con esa cuenta.`);
      else if ((requestError as ApiError).status === 401) setError("El correo o la contraseña no son correctos.");
      else setError("No pudimos aceptar la invitación. Pide una nueva si este enlace ya se usó o venció.");
    } finally {
      setSubmitting(false);
    }
  }

  if (invitation === undefined && !error) {
    return <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)]"><Skeleton className="w-full max-w-[440px] h-80" /></div>;
  }

  const title = done === "created" ? `Cuenta de ${who} creada`
    : done === "accepted" ? "Invitación aceptada"
    : invitation?.account_exists ? "Aceptar invitación"
    : `Crear cuenta de ${who}`;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)] py-8">
      <Card className="w-full max-w-[440px] flex flex-col gap-5">
        <div className="text-center">
          {done ? <CheckCircle2 size={42} className="mx-auto text-[var(--color-success-600)]" /> : <KeyRound size={38} className="mx-auto text-[var(--color-navy-700)]" />}
          <h1 className="font-display text-[var(--text-h1)] text-[var(--color-text-primary)] mt-3">{title}</h1>
          {invitation && !done && (
            <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">
              {supervisor ? <>Has sido invitado como supervisor de <strong>{invitation.organization_name}</strong>.</> : <>Has sido invitado a administrar <strong>{invitation.organization_name}</strong>.</>}
            </p>
          )}
        </div>

        {done === "created" ? (
          <>
            <p className="text-center text-[var(--text-small)] text-[var(--color-text-secondary)]">Tu cuenta quedó vinculada únicamente a la organización que te invitó.</p>
            <Button fullWidth onClick={() => navigate("/login", { replace: true })}>Iniciar sesión</Button>
          </>
        ) : done === "accepted" ? (
          <>
            <p className="text-center text-[var(--text-small)] text-[var(--color-text-secondary)]">Ya eres {who} de {invitation?.organization_name}. Tus otras agencias siguen separadas.</p>
            <Button fullWidth onClick={() => navigate("/select-organization", { replace: true })}>Entrar</Button>
          </>
        ) : invitation ? (
          <form className="flex flex-col gap-4" onSubmit={invitation.account_exists ? acceptWithExistingAccount : createAccount}>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">
              Correo invitado: <strong>{invitation.email_masked}</strong><br />
              Organización: <strong>{invitation.organization_name}</strong><br />
              Vence: {new Date(invitation.expires_at).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            {invitation.account_exists ? (
              status === "authenticated" ? (
                <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Estás conectado como <strong>{user?.email}</strong>. Acepta para unirte con esta misma cuenta.</p>
              ) : (
                <>
                  <p className="text-[var(--text-small)] text-[var(--color-text-secondary)]">Ya tienes una cuenta de ETNARA. Entra con ella para aceptar; no hace falta crear otra.</p>
                  <Input label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <Input label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </>
              )
            ) : (
              <>
                <Input label="Crea una contraseña" type="password" autoComplete="new-password" hint="Usa al menos 12 caracteres." minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Input label="Confirma la contraseña" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
              </>
            )}
            {error && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{error}</p>}
            <Button type="submit" size="lg" fullWidth loading={submitting}>{invitation.account_exists ? "Aceptar invitación" : "Crear mi cuenta"}</Button>
          </form>
        ) : (
          <>
            <p role="alert" className="text-center text-[var(--text-small)] text-[var(--color-danger-700)]">{error}</p>
            <Button variant="secondary" fullWidth onClick={() => navigate("/login")}>Volver al inicio de sesión</Button>
          </>
        )}
      </Card>
    </div>
  );
}
