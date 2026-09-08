import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Card } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { resolveExperienceRoute } from "@/auth/roles";
import { loginErrorMessage } from "@/auth/errorMessages";
import type { ApiError } from "@/api/client";

export function LoginPage() {
  const { status, login, organizations, activeOrganization, roles } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Si el bootstrap ya resolvió una sesión válida (ej. refresh con token
  // vigente) o el login recién terminó, navega a la experiencia correcta
  // en cuanto haya suficiente información para decidir a dónde.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (organizations.length > 1 && !activeOrganization) {
      navigate("/select-organization", { replace: true });
      return;
    }
    const route = resolveExperienceRoute(roles);
    if (route) navigate(route, { replace: true });
  }, [status, organizations, activeOrganization, roles, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await login(identifier.trim(), password);
      // La navegación ocurre en el useEffect de arriba una vez que
      // status/roles se actualicen -- login() ya esperó a /me internamente.
    } catch (err) {
      setErrorMessage(loginErrorMessage(err as ApiError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)]">
      <Card className="w-full max-w-[400px] flex flex-col gap-5">
        <div className="text-center">
          <h1 className="font-display text-[var(--text-h1)] text-[var(--color-text-primary)]">ETNARA Care</h1>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">
            Coordinación de cuidado, con calma y claridad.
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Input
            label="Correo electrónico o teléfono"
            type="text"
            name="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errorMessage && (
            <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{errorMessage}</p>
          )}
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Iniciar sesión
          </Button>
        </form>
      </Card>
    </div>
  );
}
