import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, Card } from "@/components/ui";
import { useAuth } from "@/auth/AuthProvider";
import { resolveExperienceRoute } from "@/auth/roles";
import { loginErrorMessage } from "@/auth/errorMessages";
import type { ApiError } from "@/api/client";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";

export function LoginPage() {
  const { status, login, organizations, activeOrganization, roles, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // The error is kept as its cause, not as text, so it follows a language change.
  const [loginError, setLoginError] = useState<ApiError | null>(null);

  // Si el bootstrap ya resolvió una sesión válida (ej. refresh con token
  // vigente) o el login recién terminó, navega a la experiencia correcta
  // en cuanto haya suficiente información para decidir a dónde.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!isPlatformAdmin && organizations.length > 1 && !activeOrganization) {
      navigate("/select-organization", { replace: true });
      return;
    }
    const route = resolveExperienceRoute(roles, isPlatformAdmin);
    if (route) navigate(route, { replace: true });
  }, [status, organizations, activeOrganization, roles, isPlatformAdmin, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLoginError(null);
    try {
      await login(identifier.trim(), password);
      // La navegación ocurre en el useEffect de arriba una vez que
      // status/roles se actualicen -- login() ya esperó a /me internamente.
    } catch (err) {
      setLoginError(err as ApiError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh flex items-center justify-center bg-[var(--color-navy-950)] px-[var(--spacing-md)] py-16">
      <LanguageSwitcher className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]" />
      <Card className="w-full max-w-[400px] flex flex-col gap-5">
        <div className="text-center">
          <h1 className="font-display text-[length:var(--text-h1)] leading-tight text-[var(--color-text-primary)]">{t("appName", { ns: "common" })}</h1>
          <p className="text-[var(--text-small)] text-[var(--color-text-secondary)] mt-1">
            {t("login.tagline")}
          </p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Input
            label={t("login.identifier")}
            type="text"
            name="identifier"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Input
            label={t("login.password")}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError && (
            <p role="alert" className="text-[var(--text-small)] text-[var(--color-danger-700)]">{loginErrorMessage(loginError)}</p>
          )}
          <Button type="submit" size="lg" fullWidth loading={submitting}>
            {t("login.submit")}
          </Button>
          <Link to="/forgot-password" className="flex min-h-11 items-center justify-center text-[var(--text-small)] font-medium text-[var(--color-navy-700)] underline-offset-4 hover:underline">
            {t("login.forgot")}
          </Link>
        </form>
      </Card>
    </div>
  );
}
