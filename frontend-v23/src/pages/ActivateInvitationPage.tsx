import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { acceptAccessInvitation, activateAccessInvitation, inspectAccessInvitation, type InvitationInspection } from "@/api/accessInvitations";
import { useAuth } from "@/auth/AuthProvider";
import { getToken } from "@/auth/token";
import type { ApiError } from "@/api/client";
import { Button, Card, Input, Skeleton } from "@/components/ui";

export function ActivateInvitationPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const token = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "", []);
  const [invitation, setInvitation] = useState<InvitationInspection | null | undefined>(token ? undefined : null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "El enlace de invitación no es válido.");

  useEffect(() => {
    if (!token) return;
    inspectAccessInvitation(token)
      .then(setInvitation)
      .catch(() => {
        setInvitation(null);
        setError("Esta invitación venció, fue utilizada o fue revocada.");
      });
  }, [token]);

  useEffect(() => {
    if (token && window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [token]);

  const finishExisting = async () => {
    const sessionToken = getToken();
    if (!sessionToken) throw new Error("SESSION_REQUIRED");
    await acceptAccessInvitation(token, sessionToken);
    await auth.refreshSession();
    setDone(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!invitation) return;
    setError(null);
    if (!invitation.account_exists && password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      if (invitation.account_exists) {
        if (auth.status !== "authenticated") await auth.login(identifier.trim(), password);
        await finishExisting();
      } else {
        await activateAccessInvitation(token, password);
        setDone(true);
      }
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.code === "INVITATION_IDENTITY_MISMATCH"
        ? "La cuenta utilizada no corresponde al correo invitado."
        : "No pudimos completar la activación. Verifica los datos o solicita un enlace nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (invitation === undefined && !error) {
    return <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)]"><Skeleton className="w-full max-w-[420px] h-80" /></div>;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)] py-8">
      <Card className="w-full max-w-[440px] flex flex-col gap-5">
        <div className="text-center">
          {done ? <CheckCircle2 size={42} className="mx-auto text-[var(--color-success-600)]" /> : <KeyRound size={38} className="mx-auto text-[var(--color-navy-700)]" />}
          <h1 className="font-display text-[var(--text-h1)] text-[var(--color-text-primary)] mt-3">{done ? "Acceso activado" : "Invitación a ETNARA Care"}</h1>
          {invitation && !done && <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">{invitation.organization_name} te invita como {invitation.invitation_type === "worker" ? "personal de cuidado" : `familiar autorizado de ${invitation.target_name}`}.</p>}
        </div>

        {done ? (
          <>
            <p className="text-center text-[var(--text-small)] text-[var(--color-text-secondary)]">Tu invitación fue aceptada correctamente.</p>
            <Button fullWidth onClick={() => navigate(invitation?.account_exists ? "/" : "/login", { replace: true })}>{invitation?.account_exists ? "Entrar a ETNARA" : "Iniciar sesión"}</Button>
          </>
        ) : invitation ? (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-ivory-100)] p-3 text-[var(--text-small)] text-[var(--color-text-secondary)]">
              Correo invitado: <strong>{invitation.email_masked}</strong><br />
              Vence: {new Date(invitation.expires_at).toLocaleString("es-PR")}
            </div>
            {invitation.account_exists && auth.status !== "authenticated" && <Input label="Correo electrónico" type="email" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />}
            {(!invitation.account_exists || auth.status !== "authenticated") && <Input label={invitation.account_exists ? "Contraseña actual" : "Crea una contraseña"} type="password" autoComplete={invitation.account_exists ? "current-password" : "new-password"} hint={!invitation.account_exists ? "Usa al menos 12 caracteres." : undefined} minLength={invitation.account_exists ? undefined : 12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />}
            {!invitation.account_exists && <Input label="Confirma la contraseña" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />}
            {error && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{error}</p>}
            <Button type="submit" size="lg" fullWidth loading={submitting}>{invitation.account_exists ? "Aceptar invitación" : "Activar mi cuenta"}</Button>
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
