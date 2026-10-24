import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, TriangleAlert } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { confirmPasswordReset } from "@/api/auth";
import { useAuth } from "@/auth/AuthProvider";
import type { ApiError } from "@/api/client";

const TOKEN = /^[0-9a-f]{64}$/i;

/**
 * Read once, then removed from the address bar and history (it is a one-use secret).
 * After an SMS code the token arrives in the navigation state, never in the URL;
 * it is removed from the history entry as well.
 */
function takeTokenFromUrl(): string | null {
  const fromState = (window.history.state?.usr as { resetToken?: unknown } | undefined)?.resetToken;
  if (fromState !== undefined) {
    window.history.replaceState({ ...window.history.state, usr: null }, "", window.location.pathname);
    return typeof fromState === "string" && TOKEN.test(fromState) ? fromState : null;
  }
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token !== null) window.history.replaceState(window.history.state, "", window.location.pathname);
  return token && TOKEN.test(token) ? token : null;
}

/**
 * Página que recibe el enlace del correo. El token es de un solo uso y vence a
 * los 30 min (lo decide el servidor). Al cambiar la contraseña el servidor
 * cierra todas las sesiones de la cuenta; si este teléfono tenía una abierta,
 * también se cierra aquí.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { status, logout } = useAuth();
  const [token] = useState(takeTokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<"form" | "done" | "invalid">(token ? "form" : "invalid");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // The server already revoked every session of the account: forget the local one too.
    if (state === "done" && status === "authenticated") void logout();
  }, [state, status, logout]);

  const tooShort = password.length > 0 && password.length < 12;
  const mismatch = confirmation.length > 0 && confirmation !== password;
  const ready = password.length >= 12 && password.length <= 128 && confirmation === password;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || !ready) return;
    setSubmitting(true);
    setProblem(null);
    try {
      await confirmPasswordReset(token, password);
      setPassword("");
      setConfirmation("");
      setState("done");
    } catch (caught) {
      const apiError = caught as ApiError;
      if (apiError.code === "INVALID_OR_EXPIRED_RESET_TOKEN") setState("invalid");
      else if (apiError.status === 0) setProblem("No pudimos conectar con ETNARA. Verifica tu conexión e inténtalo de nuevo.");
      else if (apiError.status === 429) setProblem("Demasiados intentos. Espera unos minutos y vuelve a intentarlo.");
      else if (apiError.status === 400) setProblem("La contraseña debe tener entre 12 y 128 caracteres.");
      else setProblem("No pudimos cambiar la contraseña. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)] py-8">
      <Card className="w-full max-w-[420px] flex flex-col gap-5">
        <div className="text-center">
          {state === "done" && <CheckCircle2 size={42} aria-hidden className="mx-auto text-[var(--color-success-700)]" />}
          {state === "form" && <KeyRound size={38} aria-hidden className="mx-auto text-[var(--color-navy-700)]" />}
          {state === "invalid" && <TriangleAlert size={38} aria-hidden className="mx-auto text-[var(--color-warning-700)]" />}
          <h1 className="font-display text-[length:var(--text-h1)] leading-tight text-[var(--color-text-primary)] mt-3">
            {state === "done" ? "Contraseña actualizada" : state === "invalid" ? "Enlace no válido" : "Crea una contraseña nueva"}
          </h1>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-2">
            {state === "done"
              ? "Ya puedes entrar con tu contraseña nueva. Por seguridad, cerramos la sesión en todos tus dispositivos."
              : state === "invalid"
                ? "Este enlace venció o ya se utilizó. Los enlaces y códigos sirven una sola vez y vencen pronto."
                : "Usa al menos 12 caracteres. Una frase fácil de recordar funciona bien."}
          </p>
        </div>

        {state === "done" && (
          <Button size="lg" fullWidth onClick={() => navigate("/login", { replace: true })} data-testid="reset-done">Iniciar sesión</Button>
        )}

        {state === "invalid" && (
          <div className="flex flex-col gap-3" data-testid="reset-invalid">
            <Link to="/forgot-password" className="block"><Button size="lg" fullWidth>Pedir un enlace nuevo</Button></Link>
            <Link to="/login" className="flex min-h-11 items-center justify-center text-[var(--text-small)] font-medium text-[var(--color-text-secondary)]">Volver a iniciar sesión</Link>
          </div>
        )}

        {state === "form" && (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            {/* Lets the phone's password manager save the new password. */}
            <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden tabIndex={-1} readOnly value="" />
            <Input
              label="Contraseña nueva"
              type="password"
              name="new-password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              hint={tooShort ? `Faltan ${12 - password.length} caracteres.` : "Mínimo 12 caracteres."}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Input
              label="Confirma la contraseña"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            {mismatch && <p className="text-[var(--text-small)] text-[var(--color-danger-700)]">Las contraseñas no coinciden.</p>}
            {problem && <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{problem}</p>}
            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!ready}>Guardar contraseña</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
